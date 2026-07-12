"""yt-dlp logger: strips ANSI and forwards lines to the UI."""

import re
import time
from typing import Callable

_ANSI = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
# Orphan color codes without the ESC byte (e.g. "[0;31m") that sometimes leak.
_ORPHAN = re.compile(r"\x1b?\[[0-9;]*m")


def strip_ansi(text: str) -> str:
    return _ORPHAN.sub("", _ANSI.sub("", str(text)))


class YtdlpLogger:
    """Forwards yt-dlp messages to a callback(line: str)."""

    def __init__(self, callback: Callable[[str], None]):
        self.callback = callback

    # Harmless yt-dlp notices that only confuse end users.
    _SILENCED = (
        "No supported JavaScript runtime",   # deprecation; formats still work
        "wiki/EJS",
    )

    def _emit(self, msg: str) -> None:
        clean = strip_ansi(msg).rstrip("\n")
        # Drop progress-bar spam; we have a dedicated progress_hook.
        if "[download]" in clean and "%" in clean:
            return
        if not clean:
            return
        if any(s in clean for s in self._SILENCED):
            return
        timestamp = time.strftime("%H:%M:%S")
        self.callback(f"[{timestamp}] {clean}")

    def debug(self, msg):
        if not str(msg).startswith("[debug] "):
            self._emit(msg)

    def info(self, msg):
        self._emit(msg)

    def warning(self, msg):
        self._emit(f"⚠  {msg}")

    def error(self, msg):
        self._emit(f"✖  {msg}")
