"""Path resolution for both source and frozen (PyInstaller) runs."""

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


def config_dir() -> str:
    """Settings dir, created if missing."""
    d = os.path.join(app_dir(), "config")
    os.makedirs(d, exist_ok=True)
    return d


def bin_dir() -> str:
    """Binaries dir (ffmpeg/ffprobe), created if missing."""
    d = os.path.join(app_dir(), "bin")
    os.makedirs(d, exist_ok=True)
    return d


def resource(*parts: str) -> str:
    return os.path.join(resource_dir(), *parts)


def data(*parts: str) -> str:
    return os.path.join(app_dir(), *parts)


def default_download_dir() -> str:
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    return downloads if os.path.isdir(downloads) else os.path.expanduser("~")
