"""Persistent settings backed by settings.json."""

import json
import os
import threading

from . import paths


class SettingsManager:
    DEFAULTS = {
        "download_path": "",           # filled at load time
        "language": "en",              # en | pl
        "default_type": "video",       # video | audio
        "audio_codec": "mp3",          # mp3 | wav
        "audio_quality": "192",        # kbps
        "video_container": "mp4",      # mp4 | mkv
        "cookies_browser": "",         # "" | chrome | edge | firefox | brave | opera | vivaldi
    }

    def __init__(self, filename: str | None = None):
        self.filename = filename or os.path.join(paths.config_dir(), "settings.json")
        self._lock = threading.Lock()
        self.settings = self._load()

    def _load(self) -> dict:
        data = dict(self.DEFAULTS)
        data["download_path"] = paths.default_download_dir()
        if os.path.exists(self.filename):
            try:
                with open(self.filename, "r", encoding="utf-8") as f:
                    data.update(json.load(f))
            except (OSError, json.JSONDecodeError):
                pass
        if not data.get("download_path") or not os.path.isdir(data["download_path"]):
            data["download_path"] = paths.default_download_dir()
        return data

    def save(self) -> None:
        with self._lock:
            try:
                with open(self.filename, "w", encoding="utf-8") as f:
                    json.dump(self.settings, f, indent=4, ensure_ascii=False)
            except OSError as exc:
                print(f"[settings] save failed: {exc}")

    def all(self) -> dict:
        return dict(self.settings)

    def get(self, key: str):
        return self.settings.get(key, self.DEFAULTS.get(key))

    def set(self, key: str, value) -> None:
        self.settings[key] = value
        self.save()
