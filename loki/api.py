"""Bridge between the JS frontend and the Python backend.

Public methods are called from JS via pywebview.api.<method>(...).
Events back to the UI go through window.evaluate_js in _emit().
"""

import json
import os
import subprocess
import sys
import threading
import webbrowser

import webview

from . import APP_VERSION, cookies, ffmpeg, info, paths, updates
from .downloader import Callbacks, DownloadJob, DownloadRequest
from .logger import strip_ansi
from .settings import SettingsManager


class Api:
    def __init__(self, settings: SettingsManager):
        self.settings = settings
        self._window: webview.Window | None = None
        self._job: DownloadJob | None = None

    def bind(self, window: "webview.Window") -> None:
        self._window = window

    # ------------------------------------------------------------------ #
    # Events to the frontend
    # ------------------------------------------------------------------ #
    def _emit(self, event: str, **data) -> None:
        if not self._window:
            return
        payload = json.dumps({"event": event, "data": data}, ensure_ascii=False)
        try:
            self._window.evaluate_js(f"window.Loki._receive({payload})")
        except Exception:
            pass

    def _log(self, line: str) -> None:
        self._emit("log", line=line)

    # ------------------------------------------------------------------ #
    # Settings
    # ------------------------------------------------------------------ #
    def app_version(self) -> str:
        return APP_VERSION

    def get_settings(self) -> dict:
        return self.settings.all()

    def set_setting(self, key: str, value) -> bool:
        self.settings.set(key, value)
        return True

    def choose_folder(self) -> str | None:
        if not self._window:
            return None
        try:
            folder_dialog = webview.FileDialog.FOLDER      # pywebview >= 6
        except AttributeError:
            folder_dialog = webview.FOLDER_DIALOG          # older versions
        result = self._window.create_file_dialog(
            folder_dialog, directory=self.settings.get("download_path")
        )
        if result:
            path = result[0] if isinstance(result, (list, tuple)) else result
            self.settings.set("download_path", path)
            return path
        return None

    def open_folder(self, path: str | None = None) -> bool:
        target = path or self.settings.get("download_path")
        try:
            if os.path.isdir(target):
                os.startfile(target)  # noqa: S606 — Windows
                return True
        except OSError:
            pass
        return False

    # ------------------------------------------------------------------ #
    # Cookies (encrypted store)
    # ------------------------------------------------------------------ #
    def cookies_status(self) -> dict:
        return {"secured": cookies.has()}

    def import_cookies(self) -> dict:
        if not self._window:
            return {"ok": False}
        try:
            open_dialog = webview.FileDialog.OPEN            # pywebview >= 6
        except AttributeError:
            open_dialog = webview.OPEN_DIALOG
        result = self._window.create_file_dialog(
            open_dialog,
            file_types=("Cookies (*.txt)", "All files (*.*)"),
        )
        if not result:
            return {"ok": False}
        path = result[0] if isinstance(result, (list, tuple)) else result
        try:
            cookies.import_txt(path)
            return {"ok": True}
        except ValueError as exc:
            return {"ok": False, "code": str(exc)}          # message code
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}         # raw detail

    def clear_cookies(self) -> bool:
        cookies.clear()
        return True

    # ------------------------------------------------------------------ #
    # Video info
    # ------------------------------------------------------------------ #
    def get_info(self, url: str) -> dict:
        url = (url or "").strip()
        if not url:
            return {"ok": False, "code": "err_no_url"}
        try:
            data = info.fetch(url, self._log, self.settings.get("cookies_browser"))
            return {"ok": True, "info": data}
        except Exception as exc:  # noqa: BLE001
            msg = strip_ansi(str(exc))
            self._log(f"✖  {msg}")
            return {"ok": False, "error": msg}

    # ------------------------------------------------------------------ #
    # Download
    # ------------------------------------------------------------------ #
    def start_download(self, req: dict) -> dict:
        if self._job and self._job.is_running:
            return {"ok": False, "code": "err_busy"}

        save_path = self.settings.get("download_path")
        if not os.path.isdir(save_path):
            return {"ok": False, "code": "err_no_folder"}

        request = DownloadRequest(
            url=(req.get("url") or "").strip(),
            save_path=save_path,
            kind=req.get("kind", "video"),
            height=int(req.get("height") or 0),
            hifps=bool(req.get("hifps")),
            container=req.get("container", self.settings.get("video_container")),
            audio_codec=req.get("audio_codec", self.settings.get("audio_codec")),
            audio_quality=str(req.get("audio_quality", self.settings.get("audio_quality"))),
            cookies_browser=self.settings.get("cookies_browser") or "",
        )
        if not request.url:
            return {"ok": False, "code": "err_no_url"}

        callbacks = Callbacks(
            on_progress=lambda d: self._emit("progress", **d),
            on_log=self._log,
            on_finished=self._on_finished,
            on_error=lambda msg: self._emit("error", message=msg),
            on_cancelled=lambda: self._emit("cancelled"),
        )
        self._job = DownloadJob(request, callbacks)
        self._job.start()
        return {"ok": True}

    def _on_finished(self, path: str) -> None:
        folder = os.path.dirname(path) if os.path.isfile(path) else path
        self._emit("finished", path=path, folder=folder)

    def pause_download(self) -> bool:
        if self._job and self._job.is_running:
            self._job.pause()
            return True
        return False

    def resume_download(self) -> bool:
        if self._job and self._job.is_running:
            self._job.resume()
            return True
        return False

    def cancel_download(self) -> bool:
        if self._job and self._job.is_running:
            self._job.cancel()
            return True
        return False

    # ------------------------------------------------------------------ #
    # FFmpeg
    # ------------------------------------------------------------------ #
    def check_ffmpeg(self) -> bool:
        return ffmpeg.is_available()

    def quit_app(self) -> bool:
        try:
            if self._window:
                self._window.destroy()
        except Exception:
            pass
        return True

    def download_ffmpeg(self) -> bool:
        ffmpeg.download(
            on_progress=lambda p: self._emit("ffmpeg-progress", percent=p),
            on_done=lambda ok, detail: self._emit("ffmpeg-done", ok=ok, detail=detail),
        )
        return True

    # ------------------------------------------------------------------ #
    # App update (informational only — nothing is installed)
    # ------------------------------------------------------------------ #
    def check_app_update(self) -> bool:
        """Ask the maznet.pl API in a thread; the verdict arrives as an event."""

        def worker():
            self._emit("app-update", **updates.check(APP_VERSION))

        threading.Thread(target=worker, daemon=True).start()
        return True

    def open_url(self, url: str) -> bool:
        """Open an http(s) link in the system browser."""
        url = (url or "").strip()
        if not url.lower().startswith(("http://", "https://")):
            return False
        try:
            webbrowser.open(url)
            return True
        except Exception:  # noqa: BLE001
            return False

    # ------------------------------------------------------------------ #
    # yt-dlp engine
    # ------------------------------------------------------------------ #
    def get_engine_info(self) -> dict:
        try:
            import yt_dlp

            version = yt_dlp.version.__version__
        except Exception:
            version = "?"
        return {"version": version, "frozen": paths.is_frozen()}

    def check_ytdlp_update(self) -> dict:
        """Compare the installed yt-dlp version against the latest on PyPI."""
        import urllib.request

        try:
            import yt_dlp

            current = yt_dlp.version.__version__
        except Exception:
            return {"ok": False}

        try:
            req = urllib.request.Request(
                "https://pypi.org/pypi/yt-dlp/json", headers={"User-Agent": "Loki"}
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                latest = json.load(resp)["info"]["version"]
        except Exception:
            return {"ok": False, "current": current}

        def parse(v: str):
            out = []
            for part in v.split("."):
                try:
                    out.append(int(part))
                except ValueError:
                    out.append(0)
            return tuple(out)

        return {
            "ok": True,
            "current": current,
            "latest": latest,
            "outdated": parse(latest) > parse(current),
        }

    def update_ytdlp(self) -> bool:
        """Update yt-dlp via pip (source runs only)."""
        if paths.is_frozen():
            self._emit("ytdlp-update-done", ok=False, code="ytdlp_frozen")
            return False

        def worker():
            try:
                flags = 0
                if os.name == "nt":
                    flags = subprocess.CREATE_NO_WINDOW  # no console window
                proc = subprocess.run(
                    [sys.executable, "-m", "pip", "install", "-U", "yt-dlp"],
                    capture_output=True, text=True, creationflags=flags,
                )
                if proc.returncode == 0:
                    self._emit("ytdlp-update-done", ok=True, code="ytdlp_updated")
                else:
                    tail = (proc.stderr or proc.stdout or "").strip()[-300:]
                    self._emit("ytdlp-update-done", ok=False, detail=tail or "pip error")
            except Exception as exc:  # noqa: BLE001
                self._emit("ytdlp-update-done", ok=False, detail=str(exc))

        threading.Thread(target=worker, daemon=True).start()
        return True
