<div align="center">

<img src="assets/logo-badge.png" width="120" alt="Loki logo">

# Loki — YouTube Downloader

**A clean, lightweight desktop app for downloading video and audio from YouTube.**
Native window powered by [pywebview](https://pywebview.flowrl.com/), download engine by
[yt-dlp](https://github.com/yt-dlp/yt-dlp), wrapped in a subtle Norse‑inspired UI.

![Platform](https://img.shields.io/badge/platform-Windows-1f2a33)
![Python](https://img.shields.io/badge/python-3.11%2B-1f2a33)
![UI](https://img.shields.io/badge/UI-webview%20(HTML%2FCSS%2FJS)-1f2a33)
![License](https://img.shields.io/badge/license-Apache%202.0-1f2a33)

<img src="assets/screenshot.jpg" width="640" alt="Loki screenshot">

</div>

---

## ✨ Features

- **Video** downloads (MP4 / MKV) in any available resolution — including **60 FPS** variants (e.g. `1080p60`, `720p60`).
- **Audio** downloads (MP3 / WAV) at a selectable bitrate (128–320 kbps).
- **Pause / resume / cancel** while downloading.
- **Automatic FFmpeg setup** — if it's missing, the app offers to download it on first run.
- **Age‑restricted / sign‑in content** via cookies, with an **encrypted** cookie store (Windows DPAPI) — set up once, no need to keep re‑exporting.
- **Two languages** — English and Polish, switchable live from Settings.
- Video preview (title, channel, length, thumbnail) and a built‑in log console.
- Sharp, cold, Norse‑inspired theme with a custom Loki bind‑rune icon.

## 📦 Requirements

- **Windows 10 / 11**
- **Python 3.11+** (only needed to run from source — not required for the packaged `.exe`)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (pre‑installed on Windows 11)

FFmpeg is **not** a manual dependency — the app downloads it automatically into `bin/` when needed.

## 🚀 Run from source

```bash
git clone https://github.com/<your-user>/Loki-YouTube-Downloader.git
cd Loki-YouTube-Downloader

pip install -r requirements.txt
python main.py
```

On first launch, if FFmpeg is missing, Loki will ask to download it — accept and you're ready to go.

## 🏗️ Build a standalone `.exe`

```bash
pyinstaller Loki.spec
```

This produces `dist/Loki.exe`. Web assets (`web/`, `assets/`) are bundled inside the executable;
the `bin/` (FFmpeg) and `config/` (settings) folders are created next to the `.exe` on first run.

## 🍪 Age‑restricted videos (cookies)

Some videos (18+, members‑only, sign‑in‑gated) require your YouTube session. Loki supports two ways:

1. **cookies.txt file (recommended).** Export cookies with the *“Get cookies.txt LOCALLY”* browser
   extension, then **Settings → Cookies → Load file…**. The file is **encrypted with Windows DPAPI**
   (tied to your Windows account) and stored locally — you can delete the original. Set up once, and
   you don't have to close your browser afterwards.
2. **Cookies from a browser.** Pick your browser in Settings. Note that Chromium‑based browsers lock
   their cookie database while running, so the browser must be **closed** before each download.

## 🔧 Troubleshooting

- **Weird / missing quality options** → your `yt-dlp` is likely outdated (YouTube changes often).
  Open **Settings → Download engine** and click **Update**, then restart the app.
- **“FFmpeg not found”** → let the startup dialog download it, or place `ffmpeg.exe` in `bin/`.
- **Cookie errors** → make sure the selected browser is fully closed, or use the encrypted
  cookies.txt method above.

## 🗂️ Project structure

```
main.py               entry point
loki/                 backend (logic)
  app.py              webview window
  api.py              JS ↔ Python bridge (pywebview.api)
  info.py             metadata extraction
  downloader.py       media download (threaded, pause/cancel)
  ffmpeg.py           FFmpeg detection / download
  cookies.py          encrypted cookie store (DPAPI)
  settings.py         persistent settings
  logger.py           yt-dlp logger
  paths.py            paths (source / PyInstaller)
web/                  frontend (index.html, styles.css, app.js, i18n.js)
assets/               logo & icons
fonts/                Noto Sans
bin/                  ffmpeg.exe / ffprobe.exe (auto‑downloaded)
config/               settings.json (user config)
```

## ⚖️ Disclaimer

Loki is a front‑end for `yt-dlp`. Download only content you have the right to, and respect
YouTube's Terms of Service and applicable copyright law.

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).

## 🙏 Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — download engine
- [pywebview](https://pywebview.flowrl.com/) — native webview window
- [FFmpeg](https://ffmpeg.org/) — merging & conversion
- Fonts: [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans)

---

<div align="center">

Created by **MAZNET Mateusz Mazur** - Logo based on the Norse bind‑rune of Loki

</div>
