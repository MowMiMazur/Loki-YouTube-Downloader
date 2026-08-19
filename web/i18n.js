/* ============================================================
   Loki — translations (i18n). Single source of truth for UI copy.
   Use t("key", { var: value }); static nodes: data-i18n="key".
   ============================================================ */
"use strict";

const I18N = {
  en: {
    /* Header / tabs */
    app_sub: "download from YouTube",
    tab_download: "Download",
    tab_settings: "Settings",
    tab_console: "Console",

    /* Download */
    url_ph: "https://www.youtube.com/watch?v=...",
    check: "Check",
    info_channel: "Channel",
    info_length: "Length",
    format: "Format",
    quality: "Quality",
    codec: "Codec",
    video: "Video",
    audio: "Audio",
    download: "Download",
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
    best_available: "Best available",

    /* Settings */
    save_folder: "Download folder",
    browse: "Browse",
    open: "Open",
    language: "Language",
    default_format: "Default format",
    audio_quality: "Audio quality",
    video_codec: "Video codec",
    audio_codec: "Audio codec",

    cookies_head: "Cookies — sign-in / age-restricted (18+)",
    cookies_intro: "Needed for age-restricted videos and content available after signing in.",
    cookies_file_title: "cookies.txt file <b>(recommended)</b>",
    cookies_not_loaded: "Not loaded",
    cookies_loaded: "Loaded (encrypted)",
    cookies_import: "Load file…",
    cookies_change: "Change file…",
    cookies_remove: "Remove",
    cookies_file_hint:
      "The file is <b>encrypted</b> (Windows DPAPI) and stored locally — you can delete the original. " +
      "Set up once, <b>no need to close the browser</b>. Export with the “Get cookies.txt LOCALLY” extension.",
    cookies_browser_title: "…or cookies from a browser",
    cookies_browser_none: "None",
    cookies_browser_hint:
      "Used only when no file is loaded. The selected browser must be <b>closed</b> before each download.",

    ffmpeg_label: "FFmpeg component",
    ffmpeg_checking: "Checking…",
    ffmpeg_download: "Download FFmpeg",
    ffmpeg_ready: "Detected — ready.",
    ffmpeg_missing: "Not detected. Required to merge video and convert audio.",

    engine_label: "Download engine (yt-dlp)",
    engine_update: "Update",

    copy: "Copy",
    copied: "Copied ✓",
    clear_console: "Clear console",
    console_empty: "Console is empty.",

    /* Statuses / progress */
    ready: "Ready",
    fetching_info: "Fetching info…",
    ready_to_download: "Ready to download.",
    info_error_status: "Failed to fetch info.",
    initializing: "Initializing…",
    processing: "Processing (merging / converting)…",
    downloading: "Downloading…",
    remaining: "{eta} left",
    done_check: "Completed ✓",
    dl_complete_status: "Download complete.",
    dl_error_status: "Download error.",
    resuming: "Resuming…",
    paused_status: "Paused.",
    cancelled_status: "Download cancelled.",
    cancelled_progress: "Cancelled",
    error_progress: "Error",

    /* Dialogs */
    dlg_ok: "OK",
    dlg_finished_title: "Download complete",
    dlg_finished_text: "File saved to:\n{folder}",
    dlg_saved_generic: "The file has been saved.",
    open_folder: "Open folder",
    dlg_error_title: "Error",
    dlg_info_error_text: "Failed to fetch video info.",
    unknown_error: "Unknown error.",
    dlg_cookie_locked_title: "Browser is open",
    dlg_cookie_locked_text:
      "Cannot read the cookies because the browser is running (it locks the cookie database).\n\n" +
      "Close the selected browser COMPLETELY (all windows, check the system tray too) and try again.",
    dlg_needs_cookies_title: "Sign-in required (cookies)",
    dlg_needs_cookies_text:
      "This video requires signing in — e.g. an age restriction (18+) or content available only " +
      "after logging in.\n\nGo to Settings → Cookies, pick the browser where you are signed in to " +
      "YouTube, CLOSE it and try again.",

    /* FFmpeg modal */
    ff_modal_title: "FFmpeg component required",
    ff_modal_text:
      "FFmpeg is required to merge video with audio (quality above 720p) and to convert audio. " +
      "Download it automatically now?",
    ff_modal_yes: "Download FFmpeg",
    ff_modal_no: "Close app",
    ff_progress: "Downloading FFmpeg… {pct}%",
    ff_done: "Done ✓",
    ff_ready_status: "FFmpeg ready.",
    ff_fail_status: "FFmpeg download error.",
    ff_fail_title: "Failed to download FFmpeg",
    ff_fail_text: "Error: {detail}. Try again or close the app.",
    ff_notinzip: "ffmpeg.exe not found in the archive.",
    ff_retry: "Try again",
    ff_deny_title: "FFmpeg is required",
    ff_deny_text:
      "Without FFmpeg the app cannot merge video with audio or convert audio. The app will now close.",

    /* yt-dlp engine */
    engine_version: "Version {v}",
    engine_checking: "Version {v} — checking…",
    engine_update_avail: "Newer version available: {cur} → {latest}",
    engine_current: "Version {v} — up to date",
    engine_updating: "Updating… this may take a while.",
    engine_update_err: "Update error: {detail}",
    ytdlp_updated_status: "yt-dlp updated — please restart the app.",
    ytdlp_frozen: "Update works only when running from source (python main.py).",
    ytdlp_updated: "Updated. Restart the app to use the new version.",

    /* App update (informational) */
    upd_badge: "New v{v}",
    upd_badge_hint: "A newer version is available — click for details.",
    upd_title: "A new version is available",
    upd_text:
      "A newer release of {name} has been published. The app does not update itself — " +
      "download the new version from the program page.",
    upd_current: "Installed",
    upd_latest: "Available",
    upd_released: "Released {date}",
    upd_get: "Open the download page",
    upd_later: "Later",
    upd_status: "New version {v} is available.",

    /* Cookies — dialogs */
    cookies_import_ok_title: "Cookies loaded",
    cookies_import_ok_text:
      "The cookies file was encrypted (Windows DPAPI) and stored locally. You can now delete the original file.",
    cookies_import_fail_title: "Not loaded",

    /* Backend error codes */
    err_no_url: "Enter a video link.",
    err_busy: "A download is already in progress.",
    err_no_folder: "The download folder does not exist.",
    err_not_cookies: "This doesn't look like a cookies.txt file (Netscape format).",

    footer_credit: "Created with ❤️ by MAZNET Mateusz Mazur",
  },

  pl: {
    app_sub: "pobieranie z YouTube",
    tab_download: "Pobieranie",
    tab_settings: "Ustawienia",
    tab_console: "Konsola",

    url_ph: "https://www.youtube.com/watch?v=...",
    check: "Sprawdź",
    info_channel: "Kanał",
    info_length: "Długość",
    format: "Format",
    quality: "Jakość",
    codec: "Kodek",
    video: "Wideo",
    audio: "Audio",
    download: "Pobierz",
    pause: "Pauza",
    resume: "Wznów",
    cancel: "Anuluj",
    best_available: "Najlepsza dostępna",

    save_folder: "Folder zapisu",
    browse: "Przeglądaj",
    open: "Otwórz",
    language: "Język",
    default_format: "Domyślny format",
    audio_quality: "Jakość audio",
    video_codec: "Kodek Video",
    audio_codec: "Kodek Audio",

    cookies_head: "Cookies — logowanie / filmy 18+",
    cookies_intro: "Potrzebne do filmów z ograniczeniem wieku oraz treści dostępnych po zalogowaniu.",
    cookies_file_title: "Plik cookies.txt <b>(zalecane)</b>",
    cookies_not_loaded: "Nie wczytano",
    cookies_loaded: "Wczytano (zaszyfrowane)",
    cookies_import: "Wczytaj plik…",
    cookies_change: "Zmień plik…",
    cookies_remove: "Usuń",
    cookies_file_hint:
      "Plik jest <b>szyfrowany</b> (Windows DPAPI) i przechowywany lokalnie — oryginał możesz usunąć. " +
      "Konfiguracja raz, <b>bez zamykania przeglądarki</b>. Eksport: wtyczka „Get cookies.txt LOCALLY”.",
    cookies_browser_title: "…albo cookies z przeglądarki",
    cookies_browser_none: "Brak",
    cookies_browser_hint:
      "Używane tylko gdy nie wczytano pliku. Wybraną przeglądarkę trzeba <b>zamknąć</b> przed każdym pobieraniem.",

    ffmpeg_label: "Składnik FFmpeg",
    ffmpeg_checking: "Sprawdzanie…",
    ffmpeg_download: "Pobierz FFmpeg",
    ffmpeg_ready: "Wykryto — gotowy.",
    ffmpeg_missing: "Nie wykryto. Wymagany do łączenia wideo i konwersji audio.",

    engine_label: "Silnik pobierania (yt-dlp)",
    engine_update: "Aktualizuj",

    copy: "Kopiuj",
    copied: "Skopiowano ✓",
    clear_console: "Wyczyść konsolę",
    console_empty: "Konsola jest pusta.",

    ready: "Gotowy",
    fetching_info: "Pobieranie informacji…",
    ready_to_download: "Gotowe do pobrania.",
    info_error_status: "Nie udało się pobrać informacji.",
    initializing: "Inicjowanie…",
    processing: "Przetwarzanie (łączenie / konwersja)…",
    downloading: "Pobieranie…",
    remaining: "pozostało {eta}",
    done_check: "Ukończono ✓",
    dl_complete_status: "Pobieranie ukończone.",
    dl_error_status: "Błąd pobierania.",
    resuming: "Wznawianie…",
    paused_status: "Wstrzymano.",
    cancelled_status: "Pobieranie anulowane.",
    cancelled_progress: "Anulowano",
    error_progress: "Błąd",

    dlg_ok: "OK",
    dlg_finished_title: "Pobieranie ukończone",
    dlg_finished_text: "Plik został zapisany w:\n{folder}",
    dlg_saved_generic: "Plik został zapisany.",
    open_folder: "Otwórz folder",
    dlg_error_title: "Błąd",
    dlg_info_error_text: "Nie udało się pobrać informacji o filmie.",
    unknown_error: "Nieznany błąd.",
    dlg_cookie_locked_title: "Przeglądarka jest otwarta",
    dlg_cookie_locked_text:
      "Nie można odczytać plików cookies, ponieważ przeglądarka jest uruchomiona (blokuje bazę cookies).\n\n" +
      "Zamknij CAŁKOWICIE wybraną przeglądarkę (wszystkie okna, sprawdź też ikonę w zasobniku) i spróbuj ponownie.",
    dlg_needs_cookies_title: "Wymagane logowanie (cookies)",
    dlg_needs_cookies_text:
      "Ten film wymaga zalogowania — np. ograniczenie wieku 18+ lub treść dostępna tylko po zalogowaniu.\n\n" +
      "Wejdź w Ustawienia → Cookies, wybierz przeglądarkę, w której jesteś zalogowany na YouTube, ZAMKNIJ ją i spróbuj ponownie.",

    ff_modal_title: "Wymagany składnik FFmpeg",
    ff_modal_text:
      "FFmpeg jest niezbędny do łączenia obrazu z dźwiękiem (jakość powyżej 720p) oraz konwersji audio. " +
      "Czy pobrać go teraz automatycznie?",
    ff_modal_yes: "Pobierz FFmpeg",
    ff_modal_no: "Zamknij program",
    ff_progress: "Pobieranie FFmpeg… {pct}%",
    ff_done: "Gotowe ✓",
    ff_ready_status: "FFmpeg gotowy.",
    ff_fail_status: "Błąd pobierania FFmpeg.",
    ff_fail_title: "Nie udało się pobrać FFmpeg",
    ff_fail_text: "Błąd: {detail}. Spróbuj ponownie lub zamknij program.",
    ff_notinzip: "Nie znaleziono ffmpeg.exe w archiwum.",
    ff_retry: "Spróbuj ponownie",
    ff_deny_title: "FFmpeg jest niezbędny",
    ff_deny_text:
      "Bez FFmpeg program nie może łączyć obrazu z dźwiękiem ani konwertować audio. Program zostanie zamknięty.",

    engine_version: "Wersja {v}",
    engine_checking: "Wersja {v} — sprawdzanie…",
    engine_update_avail: "Dostępna nowsza wersja: {cur} → {latest}",
    engine_current: "Wersja {v} — aktualna",
    engine_updating: "Aktualizowanie… może chwilę potrwać.",
    engine_update_err: "Błąd aktualizacji: {detail}",
    ytdlp_updated_status: "yt-dlp zaktualizowany — uruchom program ponownie.",
    ytdlp_frozen: "Aktualizacja działa tylko przy uruchomieniu ze źródeł (python main.py).",
    ytdlp_updated: "Zaktualizowano. Uruchom program ponownie, aby użyć nowej wersji.",

    upd_badge: "Nowa v{v}",
    upd_badge_hint: "Dostępna jest nowsza wersja — kliknij po szczegóły.",
    upd_title: "Dostępna nowa wersja",
    upd_text:
      "Ukazało się nowsze wydanie programu {name}. Aplikacja nie aktualizuje się sama — " +
      "pobierz nową wersję ze strony programu.",
    upd_current: "Zainstalowana",
    upd_latest: "Dostępna",
    upd_released: "Wydano {date}",
    upd_get: "Otwórz stronę pobierania",
    upd_later: "Później",
    upd_status: "Dostępna nowa wersja {v}.",

    cookies_import_ok_title: "Cookies wczytane",
    cookies_import_ok_text:
      "Plik cookies został zaszyfrowany (Windows DPAPI) i zapisany lokalnie. Oryginalny plik możesz teraz usunąć.",
    cookies_import_fail_title: "Nie wczytano",

    err_no_url: "Wprowadź link do filmu.",
    err_busy: "Pobieranie jest już w toku.",
    err_no_folder: "Folder zapisu nie istnieje.",
    err_not_cookies: "To nie wygląda na plik cookies.txt (format Netscape).",

    footer_credit: "Stworzono z ❤️ przez MAZNET Mateusz Mazur.",
  },
};

let LANG = "en";

function setLangCode(code) {
  LANG = I18N[code] ? code : "en";
}

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || (I18N.en && I18N.en[key]) || key;
  if (vars) {
    for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
  }
  return s;
}

/* Apply translations to static nodes (data-i18n / data-i18n-ph). */
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
}
