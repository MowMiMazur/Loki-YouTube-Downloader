"""Encrypted cookie storage.

The Netscape cookies.txt yt-dlp needs is plaintext and holds a Google session,
so we encrypt it with Windows DPAPI (tied to the OS user) into config/cookies.dat
and only decrypt to a temp file for the duration of a yt-dlp run.
"""

import ctypes
import os
import tempfile
from ctypes import wintypes
from contextlib import contextmanager

from . import paths


def _store() -> str:
    return os.path.join(paths.config_dir(), "cookies.dat")


# --------------------------- Windows DPAPI --------------------------- #
class _DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _to_blob(data: bytes):
    buf = ctypes.create_string_buffer(data, len(data))
    return _DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf


def _from_blob(blob: "_DATA_BLOB") -> bytes:
    size = blob.cbData
    ptr = ctypes.cast(blob.pbData, ctypes.POINTER(ctypes.c_char * size))
    data = bytes(ptr.contents)
    ctypes.windll.kernel32.LocalFree(blob.pbData)
    return data


def _encrypt(data: bytes) -> bytes:
    in_blob, _buf = _to_blob(data)
    out_blob = _DATA_BLOB()
    ok = ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(in_blob), "Loki cookies", None, None, None, 0, ctypes.byref(out_blob)
    )
    if not ok:
        raise OSError("CryptProtectData failed")
    return _from_blob(out_blob)


def _decrypt(data: bytes) -> bytes:
    in_blob, _buf = _to_blob(data)
    out_blob = _DATA_BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
    )
    if not ok:
        raise OSError("CryptUnprotectData failed")
    return _from_blob(out_blob)


# ------------------------------- API -------------------------------- #
def has() -> bool:
    return os.path.exists(_store())


def import_txt(src_path: str) -> None:
    """Read a plaintext cookies.txt, encrypt it, and store it."""
    with open(src_path, "rb") as f:
        raw = f.read()
    if b"# Netscape HTTP Cookie File" not in raw and b"\t" not in raw:
        raise ValueError("err_not_cookies")   # message code (translated in UI)
    with open(_store(), "wb") as f:
        f.write(_encrypt(raw))


def clear() -> None:
    try:
        os.remove(_store())
    except OSError:
        pass


@contextmanager
def temp_cookiefile():
    """Yield a path to a temporary decrypted cookies.txt (or None)."""
    if not has():
        yield None
        return
    try:
        data = _decrypt(open(_store(), "rb").read())
    except Exception:
        yield None
        return
    fd, path = tempfile.mkstemp(prefix="loki_ck_", suffix=".txt")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        yield path
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
