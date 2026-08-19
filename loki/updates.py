"""Update check against the maznet.pl API — informational only.

The endpoint is public and read-only:
    GET https://maznet.pl/api/v1/updates/<slug>?version=<installed>

Nothing is downloaded or installed here — the UI only tells the user that a
newer release exists and links to the program page returned by the API.
"""

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from . import APP_NAME, APP_VERSION, paths

SLUG = "loki-youtube-downloader"
API_URL = "https://maznet.pl/api/v1/updates/{slug}"
PAGE_FALLBACK = "https://maznet.pl/aplikacje/loki-youtube-downloader"

_TIMEOUT = 8
_CACHE_TTL = 300          # matches the endpoint's Cache-Control: max-age=300


# ---------------------------------------------------------------------- #
# Cached response (ETag + body), so restarts don't burn the rate limit
# ---------------------------------------------------------------------- #
def _cache_file() -> str:
    return os.path.join(paths.config_dir(), "update_cache.json")


def _read_cache(current: str) -> dict:
    try:
        with open(_cache_file(), "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    # The verdict depends on the version we asked about — ignore a stale one.
    if not isinstance(data, dict) or data.get("version") != current:
        return {}
    return data


def _write_cache(current: str, etag: str | None, body: dict) -> None:
    try:
        with open(_cache_file(), "w", encoding="utf-8") as f:
            json.dump(
                {"version": current, "etag": etag, "body": body, "ts": time.time()},
                f, ensure_ascii=False,
            )
    except OSError:
        pass


# ---------------------------------------------------------------------- #
# Version comparison (fallback when the API sends no `update` block)
# ---------------------------------------------------------------------- #
def _parts(version: str) -> list[int]:
    out = []
    for chunk in re.split(r"[.\-+_]", str(version).strip().lstrip("vV")):
        match = re.match(r"\d+", chunk)
        out.append(int(match.group()) if match else 0)
    return out or [0]


def clean(version: str) -> str:
    """Display form: the API may hand back a tag like "v1.0.0"."""
    return str(version or "").strip().lstrip("vV")


def is_newer(latest: str, current: str) -> bool:
    a, b = _parts(latest), _parts(current)
    size = max(len(a), len(b))
    a += [0] * (size - len(a))
    b += [0] * (size - len(b))
    return a > b


# ---------------------------------------------------------------------- #
# Public API
# ---------------------------------------------------------------------- #
def check(current: str = APP_VERSION, timeout: int = _TIMEOUT) -> dict:
    """Ask the API about the newest release. Never raises."""
    cache = _read_cache(current)
    cached_body = cache.get("body") if isinstance(cache.get("body"), dict) else None

    # Still inside the declared cache window — don't ask again.
    if cached_body and (time.time() - float(cache.get("ts") or 0)) < _CACHE_TTL:
        return _result(cached_body, current)

    url = "{}?version={}".format(
        API_URL.format(slug=SLUG), urllib.parse.quote(current, safe="")
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"{APP_NAME}/{current} (Windows)",
            "Accept": "application/json",
        },
    )
    etag = cache.get("etag")
    if etag and cached_body:
        request.add_header("If-None-Match", etag)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8", "replace"))
            new_etag = response.headers.get("ETag") or etag
    except urllib.error.HTTPError as exc:
        if exc.code == 304 and cached_body:                 # nothing changed
            _write_cache(current, etag, cached_body)
            return _result(cached_body, current)
        return {"ok": False, "code": exc.code, "current": current}
    except Exception:                                       # noqa: BLE001 — offline etc.
        return {"ok": False, "current": current}

    if not isinstance(body, dict) or body.get("status") != "success":
        return {"ok": False, "current": current}

    _write_cache(current, new_etag, body)
    return _result(body, current)


def _result(body: dict, current: str) -> dict:
    program = body.get("program") or {}
    update = body.get("update") or {}
    latest = str(program.get("version") or update.get("latest") or "").strip()
    if not latest:
        return {"ok": False, "current": current}

    available = update.get("available")
    if not isinstance(available, bool):
        available = is_newer(latest, current)

    download = program.get("download") if isinstance(program.get("download"), dict) else None

    return {
        "ok": True,
        "available": bool(available),
        "current": clean(current),
        "latest": clean(latest),
        "name": program.get("name") or APP_NAME,
        "page": program.get("page") or PAGE_FALLBACK,
        "released_at": program.get("released_at") or "",
        "channel": program.get("channel") or "",
        "download": download,
    }
