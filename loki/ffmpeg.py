"""FFmpeg detection and auto-download (required by yt-dlp)."""

import os
import shutil
import threading
import urllib.request
import zipfile
from typing import Callable

from . import paths

_FFMPEG_URL = (
    "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/"
    "ffmpeg-master-latest-win64-gpl.zip"
)
_TARGETS = ("ffmpeg.exe", "ffprobe.exe")


def ffmpeg_path() -> str:
    return os.path.join(paths.bin_dir(), "ffmpeg.exe")


def is_available() -> bool:
    """True if ffmpeg is in bin/ or on PATH."""
    return location() is not None


def location() -> str | None:
    """ffmpeg dir for yt-dlp's ffmpeg_location: bin/ or PATH."""
    if os.path.exists(ffmpeg_path()):
        return paths.bin_dir()
    which = shutil.which("ffmpeg")
    return os.path.dirname(which) if which else None


def download(
    on_progress: Callable[[int], None],
    on_done: Callable[[bool, str], None],
) -> None:
    """Download FFmpeg in a thread and extract it into bin/."""

    def worker():
        zip_path = os.path.join(paths.bin_dir(), "_ffmpeg_tmp.zip")
        try:
            req = urllib.request.Request(
                _FFMPEG_URL, headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req) as resp:
                total = int(resp.headers.get("content-length") or 0)
                done = 0
                with open(zip_path, "wb") as out:
                    while True:
                        chunk = resp.read(1 << 16)
                        if not chunk:
                            break
                        out.write(chunk)
                        done += len(chunk)
                        if total:
                            on_progress(int(done * 90 / total))

            on_progress(92)
            found = _extract(zip_path)
            _safe_remove(zip_path)
            on_progress(100)

            if found:
                on_done(True, "")
            else:
                on_done(False, "ffmpeg_not_in_zip")     # message code
        except Exception as exc:  # noqa: BLE001
            _safe_remove(zip_path)
            on_done(False, str(exc))                    # raw detail

    threading.Thread(target=worker, daemon=True).start()


def _extract(zip_path: str) -> bool:
    found = False
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.namelist():
            name = os.path.basename(member).lower()
            if name in _TARGETS:
                dest = os.path.join(paths.bin_dir(), name)
                with zf.open(member) as src, open(dest, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                if name == "ffmpeg.exe":
                    found = True
    return found


def terminate_children() -> int:
    """Kill ffmpeg/ffprobe processes started by this app; return how many.

    yt-dlp runs FFmpeg through a blocking Popen.run(), so a merge or an audio
    conversion cannot be interrupted from a hook — the only way to stop it is to
    end the process. Only our own children are touched, never an FFmpeg the user
    happens to be running elsewhere.
    """
    if os.name != "nt":
        return 0

    import ctypes
    from ctypes import wintypes

    TH32CS_SNAPPROCESS = 0x0002
    PROCESS_TERMINATE = 0x0001
    INVALID_HANDLE = ctypes.c_void_p(-1).value

    class PROCESSENTRY32(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ProcessID", wintypes.DWORD),
            ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
            ("th32ModuleID", wintypes.DWORD),
            ("cntThreads", wintypes.DWORD),
            ("th32ParentProcessID", wintypes.DWORD),
            ("pcPriClassBase", ctypes.c_long),
            ("dwFlags", wintypes.DWORD),
            ("szExeFile", ctypes.c_char * 260),
        ]

    kernel32 = ctypes.windll.kernel32
    snapshot = kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
    if snapshot == INVALID_HANDLE:
        return 0

    killed = 0
    try:
        entry = PROCESSENTRY32()
        entry.dwSize = ctypes.sizeof(PROCESSENTRY32)
        ours = os.getpid()
        more = kernel32.Process32First(snapshot, ctypes.byref(entry))
        while more:
            name = entry.szExeFile.decode("latin-1", "replace").lower()
            if entry.th32ParentProcessID == ours and name in _TARGETS:
                handle = kernel32.OpenProcess(PROCESS_TERMINATE, False, entry.th32ProcessID)
                if handle:
                    if kernel32.TerminateProcess(handle, 1):
                        killed += 1
                    kernel32.CloseHandle(handle)
            more = kernel32.Process32Next(snapshot, ctypes.byref(entry))
    finally:
        kernel32.CloseHandle(snapshot)
    return killed


def _safe_remove(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
