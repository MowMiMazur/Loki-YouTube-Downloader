"""Threaded media download via yt-dlp with pause/cancel."""

import os
import threading
import time
from dataclasses import dataclass, field
from typing import Callable

import yt_dlp

from .logger import YtdlpLogger, strip_ansi


class DownloadCancelled(Exception):
    pass


@dataclass
class DownloadRequest:
    url: str
    save_path: str
    kind: str = "video"           # video | audio
    height: int = 0               # 0 = best available
    hifps: bool = False           # True = high frame-rate variant (60 fps)
    container: str = "mp4"        # video: mp4 | mkv
    audio_codec: str = "mp3"      # audio: mp3 | wav
    audio_quality: str = "192"    # kbps
    cookies_browser: str = ""     # browser cookies (sign-in / age)

    def to_ydl_opts(self, progress_hook, logger) -> dict:
        opts = {
            "outtmpl": os.path.join(self.save_path, "%(title)s.%(ext)s"),
            "noplaylist": True,
            "no_warnings": True,
            "ignoreerrors": False,
            "progress_hooks": [progress_hook],
            "logger": logger,
            "ffmpeg_location": _ffmpeg_dir(),
        }
        if self.kind == "audio":
            opts["format"] = "bestaudio/best"
            opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": self.audio_codec,
                    "preferredquality": self.audio_quality,
                }
            ]
        else:
            if self.height and self.height > 0:
                h = self.height
                fps = "[fps>=48]" if self.hifps else "[fps<48]"
                opts["format"] = (
                    f"bestvideo[height<={h}]{fps}+bestaudio/"   # exact fps variant
                    f"bestvideo[height<={h}]+bestaudio/"        # any fps at this height
                    f"best[height<={h}]/best"                    # progressive fallback
                )
            else:
                opts["format"] = "bestvideo+bestaudio/best"
            opts["merge_output_format"] = self.container
        return opts


def _ffmpeg_dir() -> str | None:
    from . import ffmpeg

    return ffmpeg.location()  # bin/ or PATH; None => yt-dlp resolves itself


@dataclass
class Callbacks:
    on_progress: Callable[[dict], None] = lambda d: None
    on_log: Callable[[str], None] = lambda s: None
    on_finished: Callable[[str], None] = lambda path: None
    on_error: Callable[[str], None] = lambda msg: None
    on_cancelled: Callable[[], None] = lambda: None


class DownloadJob:
    """A single download, controlled from the UI thread."""

    def __init__(self, request: DownloadRequest, callbacks: Callbacks):
        self.request = request
        self.cb = callbacks
        self._cancel = threading.Event()
        self._pause = threading.Event()
        self._thread: threading.Thread | None = None
        self._filename: str | None = None
        self._final_path: str | None = None

    # --- control ---
    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def cancel(self) -> None:
        self._cancel.set()
        self._pause.clear()

    def pause(self) -> None:
        self._pause.set()

    def resume(self) -> None:
        self._pause.clear()

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    @property
    def is_paused(self) -> bool:
        return self._pause.is_set()

    # --- worker thread ---
    def _run(self) -> None:
        from . import cookies

        logger = YtdlpLogger(self.cb.on_log)
        opts = self.request.to_ydl_opts(self._progress_hook, logger)
        try:
            with cookies.temp_cookiefile() as cf:
                if cf:
                    opts["cookiefile"] = cf          # encrypted store takes precedence
                elif self.request.cookies_browser:
                    opts["cookiesfrombrowser"] = (self.request.cookies_browser, None, None, None)
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([self.request.url])
            if self._cancel.is_set():
                raise DownloadCancelled()
            self.cb.on_finished(self._final_path or self.request.save_path)
        except DownloadCancelled:
            self._cleanup_partial()
            self.cb.on_cancelled()
        except Exception as exc:  # noqa: BLE001 — surfaced to the user
            if self._cancel.is_set():
                self._cleanup_partial()
                self.cb.on_cancelled()
            else:
                self.cb.on_error(strip_ansi(str(exc)))

    def _cleanup_partial(self) -> None:
        if not self._filename:
            return
        for candidate in (self._filename, self._filename + ".part"):
            try:
                if os.path.exists(candidate):
                    os.remove(candidate)
            except OSError:
                pass

    def _progress_hook(self, d: dict) -> None:
        if d.get("filename"):
            self._filename = d["filename"]
        if self._cancel.is_set():
            raise DownloadCancelled()

        while self._pause.is_set():
            time.sleep(0.1)
            if self._cancel.is_set():
                raise DownloadCancelled()

        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            percent = (done / total * 100) if total else 0.0
            self.cb.on_progress(
                {
                    "phase": "downloading",
                    "percent": round(percent, 1),
                    "speed": strip_ansi(d.get("_speed_str", "—")).strip(),
                    "eta": strip_ansi(d.get("_eta_str", "—")).strip(),
                    "size": strip_ansi(d.get("_total_bytes_str", "")).strip(),
                }
            )
        elif status == "finished":
            self._final_path = d.get("filename") or self._final_path
            self.cb.on_progress({"phase": "processing", "percent": 100})
