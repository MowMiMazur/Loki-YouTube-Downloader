"""Threaded media download via yt-dlp with pause/cancel."""

import os
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Callable

import yt_dlp

from .logger import YtdlpLogger, strip_ansi


class DownloadCancelled(Exception):
    pass


def _is_forbidden(exc: Exception) -> bool:
    """True for YouTube's "HTTP Error 403: Forbidden" on a stream URL."""
    msg = strip_ansi(str(exc)).lower()
    return "403" in msg and "forbidden" in msg


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
    progressive: bool = False     # last resort: the one stream YouTube still serves

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
        if self.progressive:
            # YouTube refuses DASH streams (403) to callers without a PO token;
            # the android client's progressive 360p is still served in full.
            opts["extractor_args"] = {"youtube": {"player_client": ["android"]}}
            opts["format"] = "18/best[acodec!=none][vcodec!=none]/best"
            if self.kind == "audio":
                opts["postprocessors"] = [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": self.audio_codec,
                        "preferredquality": self.audio_quality,
                    }
                ]
            return opts

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

    MAX_ATTEMPTS = 3      # 1 regular attempt + 2 retries on a 403
    RETRY_DELAY = 4       # seconds; multiplied by the attempt number

    def __init__(self, request: DownloadRequest, callbacks: Callbacks):
        self.request = request
        self.cb = callbacks
        self._cancel = threading.Event()
        self._pause = threading.Event()
        self._thread: threading.Thread | None = None
        self._filename: str | None = None
        self._final_path: str | None = None
        self._touched: set[str] = set()   # every file yt-dlp reported writing
        self._started_at = 0.0            # cleanup guard: only this run's files

    # --- control ---
    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def cancel(self) -> None:
        self._cancel.set()
        self._pause.clear()
        # During downloading the progress hook picks the flag up on its own. While
        # FFmpeg merges or converts, nothing calls back into us — yt-dlp waits on a
        # blocking Popen — so the running FFmpeg has to be ended here.
        from . import ffmpeg

        killed = ffmpeg.terminate_children()
        if killed:
            self.cb.on_log("[Loki] Cancelled during processing — FFmpeg stopped.")

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

        self._started_at = time.time()

        logger = YtdlpLogger(self.cb.on_log)
        opts = self.request.to_ydl_opts(self._progress_hook, logger)
        opts["postprocessor_hooks"] = [self._postprocessor_hook]
        try:
            with cookies.temp_cookiefile() as cf:
                if cf:
                    opts["cookiefile"] = cf          # encrypted store takes precedence
                elif self.request.cookies_browser:
                    opts["cookiesfrombrowser"] = (self.request.cookies_browser, None, None, None)
                self._download_with_retries(opts)
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

    def _download_with_retries(self, opts: dict) -> None:
        """YouTube answers 403 to a perfectly good stream URL now and then (rate
        limiting on the caller's IP). Re-extract and try again rather than
        failing the whole job on the first refusal."""
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([self.request.url])
                return
            except DownloadCancelled:
                raise
            except Exception as exc:  # noqa: BLE001 — re-raised below
                last = attempt == self.MAX_ATTEMPTS
                if self._cancel.is_set() or last or not _is_forbidden(exc):
                    raise
                self.cb.on_log(
                    f"[Loki] HTTP 403 — retrying ({attempt}/{self.MAX_ATTEMPTS - 1})…"
                )
                self._sleep_cancellable(self.RETRY_DELAY * attempt)

    def _sleep_cancellable(self, seconds: float) -> None:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self._cancel.is_set():
                raise DownloadCancelled()
            time.sleep(0.1)

    def _cleanup_partial(self) -> None:
        """Remove what a cancelled job left behind: the separate video/audio
        streams, their .part/.ytdl companions, and the half-merged or
        half-converted output FFmpeg was killed in the middle of."""
        candidates: set[str] = set()
        for base in {p for p in (*self._touched, self._filename, self._final_path) if p}:
            stem, ext = os.path.splitext(base)
            candidates.update((base, base + ".part", base + ".ytdl", f"{stem}.temp{ext}"))
            # Single streams are named "<title>.f<id>.<ext>"; the merged or
            # converted result drops that suffix and takes the target extension.
            merged = re.sub(r"\.f\d+$", "", stem)
            for out_ext in (self.request.container, self.request.audio_codec, ext.lstrip(".")):
                if out_ext:
                    candidates.add(f"{merged}.{out_ext}")
                    candidates.add(f"{merged}.temp.{out_ext}")

        for path in candidates:
            try:
                # Only ever touch files this job itself wrote: a name can collide
                # with an earlier, finished download the user wants to keep.
                if os.path.isfile(path) and os.path.getmtime(path) >= self._started_at:
                    os.remove(path)
            except OSError:
                pass

    def _postprocessor_hook(self, d: dict) -> None:
        """Runs between postprocessors — the only callback FFmpeg stages give us."""
        info = d.get("info_dict") or {}
        for key in ("filepath", "_filename", "filename"):
            if info.get(key):
                self._touched.add(info[key])
        # The progress hook only ever sees the separate streams; the merged or
        # converted file is what the user should be pointed at when it is done.
        if d.get("status") == "finished" and info.get("filepath"):
            self._final_path = info["filepath"]
        if self._cancel.is_set():
            raise DownloadCancelled()

    def _progress_hook(self, d: dict) -> None:
        if d.get("filename"):
            self._filename = d["filename"]
            self._touched.add(d["filename"])
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
