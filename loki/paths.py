"""Path resolution for both source and frozen (PyInstaller) runs."""

import functools
import os
import sys


def is_frozen() -> bool:
    return getattr(sys, "frozen", False)


def resource_dir() -> str:
    """Bundled assets root (web/, assets/, fonts/)."""
    if is_frozen():
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def app_dir() -> str:
    """Writable dir next to the executable (settings, ffmpeg)."""
    if is_frozen():
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@functools.lru_cache(maxsize=None)
def _writable_dir(name: str) -> str:
    """<app>/<name>, or a per-user fallback when the app sits somewhere
    read-only (Program Files, a network share, a folder locked by security
    software). Never raises — a caller must not lose FFmpeg detection just
    because a directory could not be created."""
    primary = os.path.join(app_dir(), name)
    try:
        os.makedirs(primary, exist_ok=True)
        probe = os.path.join(primary, ".write-test")
        with open(probe, "w"):
            pass
        os.remove(probe)
        return primary
    except OSError:
        pass

    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    fallback = os.path.join(base, "Loki", name)
    try:
        os.makedirs(fallback, exist_ok=True)
    except OSError:
        return primary          # nothing writable; callers degrade gracefully
    return fallback


def config_dir() -> str:
    """Settings dir, created if missing."""
    return _writable_dir("config")


def bin_dir() -> str:
    """Binaries dir (ffmpeg/ffprobe), created if missing."""
    return _writable_dir("bin")


def resource(*parts: str) -> str:
    return os.path.join(resource_dir(), *parts)


def data(*parts: str) -> str:
    return os.path.join(app_dir(), *parts)


def default_download_dir() -> str:
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    return downloads if os.path.isdir(downloads) else os.path.expanduser("~")
