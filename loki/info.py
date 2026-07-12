"""Fetch and summarize video metadata (no media download)."""

from typing import Callable

import yt_dlp

from . import cookies, ffmpeg
from .logger import YtdlpLogger


def _pick_thumbnail(info: dict) -> str:
    thumbs = info.get("thumbnails") or []
    best = ""
    best_w = -1
    for t in thumbs:
        w = t.get("width") or 0
        if t.get("url") and w >= best_w:
            best, best_w = t["url"], w
    return best or info.get("thumbnail", "") or ""


def available_qualities(info: dict) -> list[dict]:
    """Video qualities as (height, fps) pairs, grouped by height and fps tier
    (high >=48 fps vs standard). Returns {height, fps, hi, label}, sorted desc."""
    buckets: dict[tuple[int, bool], int] = {}
    for f in info.get("formats", []):
        if f.get("vcodec") in (None, "none") or not f.get("height"):
            continue
        height = int(f["height"])
        fps = round(f.get("fps") or 0)
        hi = fps >= 48
        key = (height, hi)
        buckets[key] = max(buckets.get(key, 0), fps)   # representative fps

    out = []
    for (height, hi), fps in buckets.items():
        label = f"{height}p{fps}" if hi and fps else f"{height}p"
        out.append({"height": height, "fps": fps, "hi": hi, "label": label})
    out.sort(key=lambda q: (q["height"], q["fps"]), reverse=True)
    return out


def summarize(info: dict) -> dict:
    """Trimmed dict passed to the frontend (drops heavy fields)."""
    return {
        "id": info.get("id", ""),
        "title": info.get("title", "—"),
        "uploader": info.get("uploader") or info.get("channel") or "—",
        "duration_string": info.get("duration_string")
        or _fmt_duration(info.get("duration")),
        "thumbnail": _pick_thumbnail(info),
        "qualities": available_qualities(info),
        "is_playlist": info.get("_type") == "playlist",
    }


def _fmt_duration(seconds) -> str:
    if not seconds:
        return "—"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def fetch(url: str, log: Callable[[str], None], cookies_browser: str = "") -> dict:
    """Return trimmed metadata; raises on failure."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "logger": YtdlpLogger(log),
    }
    loc = ffmpeg.location()
    if loc:
        opts["ffmpeg_location"] = loc
    with cookies.temp_cookiefile() as cf:
        if cf:
            opts["cookiefile"] = cf                   # encrypted store takes precedence
        elif cookies_browser:
            opts["cookiesfrombrowser"] = (cookies_browser, None, None, None)
        with yt_dlp.YoutubeDL(opts) as ydl:
            return summarize(ydl.extract_info(url, download=False))
