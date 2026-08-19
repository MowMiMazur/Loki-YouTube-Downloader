/* ============================================================
   Loki — UI logic and backend bridge (pywebview.api).
   All copy comes from i18n.js (t / applyStaticI18n).
   ============================================================ */
"use strict";

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* Notification sound, played on every dialog. */
const notifySound = new Audio("media/notify.mp3");
notifySound.volume = 0.7;
function playNotify() {
  try {
    notifySound.currentTime = 0;
    const p = notifySound.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore (e.g. autoplay blocked) */ }
}

const state = {
  kind: "video",
  downloading: false,
  paused: false,
  ffmpegModalOpen: false,
  ffmpegAvailable: null,   // null = not checked yet
  engine: null,            // { version, frozen, update }
  update: null,            // app update info from the maznet.pl API
  updatePending: false,    // show the update modal once FFmpeg is out of the way
};

/* ---------- Bridge: Python → JS events ---------- */
window.Loki = {
  _receive(payload) {
    const { event, data } = payload || {};
    const fn = Loki._handlers[event];
    if (fn) fn(data || {});
  },
  _handlers: {
    log:  (d) => appendLog(d.line),
    progress: (d) => onProgress(d),
    finished: (d) => onFinished(d),
    error:    (d) => onError(d.message),
    cancelled: () => onCancelled(),
    "ffmpeg-progress": (d) => onFfmpegProgress(d),
    "ffmpeg-done": (d) => onFfmpegDone(d),
    "ytdlp-update-done": (d) => onYtdlpUpdateDone(d),
    "app-update": (d) => onAppUpdate(d),
  },
};

/* ---------- API helpers ---------- */
let apiReady = false;
const pending = [];
function api() { return window.pywebview && window.pywebview.api; }
function whenReady(fn) { apiReady ? fn() : pending.push(fn); }

window.addEventListener("pywebviewready", () => {
  apiReady = true;
  pending.splice(0).forEach((fn) => fn());
});

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  applyStaticI18n();
  wireTabs();
  wireKind();
  wireDownloadFlow();
  wireSettings();
  wireConsole();
  wireFfmpegModal();
  wireUpdateModal();
  wireDialog();
  resetQuality();
  whenReady(loadAppVersion);
  whenReady(loadSettings);
  whenReady(checkFfmpeg);
  whenReady(loadEngineInfo);
  whenReady(refreshCookiesStatus);
});

function loadAppVersion() {
  api().app_version().then((v) => { $("#app-version").textContent = "v" + v; });
}

/* ---------- Language ---------- */
function applyLanguage(code) {
  setLangCode(code);
  document.documentElement.lang = code;
  applyStaticI18n();
  updateBestOption();
  renderFfmpegStatus();
  renderEngineStatus();
  renderUpdateBadge();
  refreshCookiesStatus();
}

function updateBestOption() {
  const opt = $("#sel-quality").options[0];
  if (opt && opt.value === "best") opt.textContent = t("best_available");
}

/* ---------- Tabs ---------- */
function wireTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      $$(".panel").forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      $(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
    });
  });
}

/* ---------- Format: video / audio ---------- */
function wireKind() {
  $$("#seg-kind .seg").forEach((seg) => {
    seg.addEventListener("click", () => setKind(seg.dataset.kind));
  });
}
function setKind(kind) {
  state.kind = kind;
  $$("#seg-kind .seg").forEach((s) => s.classList.toggle("is-active", s.dataset.kind === kind));
  $$("[data-when]").forEach((el) => (el.hidden = el.dataset.when !== kind));
}

/* ---------- Download flow ---------- */
function wireDownloadFlow() {
  const url = $("#url");
  url.addEventListener("input", () => {
    $("#btn-download").disabled = url.value.trim() === "" || state.downloading;
  });
  url.addEventListener("keydown", (e) => { if (e.key === "Enter") fetchInfo(); });

  $("#btn-check").addEventListener("click", fetchInfo);
  $("#btn-download").addEventListener("click", startDownload);
  $("#btn-pause").addEventListener("click", togglePause);
  $("#btn-cancel").addEventListener("click", () => whenReady(() => api().cancel_download()));
}

function resetQuality() {
  const sel = $("#sel-quality");
  sel.innerHTML = "";
  sel.appendChild(new Option(t("best_available"), "best"));
}

async function fetchInfo() {
  const url = $("#url").value.trim();
  if (!url) return;
  setStatus(t("fetching_info"));
  $("#btn-check").disabled = true;
  whenReady(async () => {
    try {
      const res = await api().get_info(url);
      if (!res.ok) {
        setStatus(t("info_error_status"));
        if (res.code) showDialog({ kind: "error", title: t("dlg_error_title"), text: t(res.code) });
        else showDownloadError(res.error);
        return;
      }
      showInfo(res.info);
      setStatus(t("ready_to_download"));
    } catch (e) {
      setStatus(t("info_error_status"));
      showDialog({ kind: "error", title: t("dlg_error_title"), text: t("dlg_info_error_text") });
    } finally {
      $("#btn-check").disabled = false;
    }
  });
}

function showInfo(info) {
  $("#info-title").textContent = info.title || "—";
  $("#info-uploader").textContent = info.uploader || "—";
  $("#info-duration").textContent = info.duration_string || "—";
  const img = $("#info-thumb-img");
  img.src = info.thumbnail || "";
  $("#info-card").hidden = false;

  const sel = $("#sel-quality");
  sel.innerHTML = "";
  sel.appendChild(new Option(t("best_available"), "best"));
  (info.qualities || []).forEach((q) =>
    sel.appendChild(new Option(q.label, `${q.height}:${q.hi ? 1 : 0}`))
  );
  $("#btn-download").disabled = false;
}

function startDownload() {
  const url = $("#url").value.trim();
  if (!url) return;
  let height = 0;
  let hifps = false;
  if (state.kind === "video") {
    const v = $("#sel-quality").value; // "best" or "1080:1"
    if (v && v !== "best") {
      const [h, hi] = v.split(":");
      height = parseInt(h, 10) || 0;
      hifps = hi === "1";
    }
  }
  const req = {
    url,
    kind: state.kind,
    height,
    hifps,
    container: $("#sel-container").value,
    audio_codec: $("#sel-codec").value,
    audio_quality: $("#sel-abr").value,
  };
  whenReady(async () => {
    const res = await api().start_download(req);
    if (!res.ok) {
      if (res.code) showDialog({ kind: "error", title: t("dlg_error_title"), text: t(res.code) });
      return;
    }
    enterDownloadingUI();
  });
}

function enterDownloadingUI() {
  state.downloading = true;
  state.paused = false;
  $("#btn-download").hidden = true;
  $("#btn-pause").hidden = false;
  $("#btn-cancel").hidden = false;
  $("#btn-pause").textContent = t("pause");
  $("#btn-check").disabled = true;
  setProgress(0, t("initializing"));
  $("#progress-bar").classList.add("is-indeterminate");
}

function leaveDownloadingUI() {
  state.downloading = false;
  state.paused = false;
  $("#btn-download").hidden = false;
  $("#btn-download").disabled = $("#url").value.trim() === "";
  $("#btn-pause").hidden = true;
  $("#btn-cancel").hidden = true;
  $("#btn-check").disabled = false;
  $("#progress-bar").classList.remove("is-indeterminate");
}

function togglePause() {
  whenReady(async () => {
    if (state.paused) {
      await api().resume_download();
      state.paused = false;
      $("#btn-pause").textContent = t("pause");
      setStatus(t("resuming"));
    } else {
      await api().pause_download();
      state.paused = true;
      $("#btn-pause").textContent = t("resume");
      setStatus(t("paused_status"));
    }
  });
}

/* ---------- Progress events ---------- */
function onProgress(d) {
  const bar = $("#progress-bar");
  if (d.phase === "processing") {
    bar.classList.add("is-indeterminate");
    setProgress(100, t("processing"));
    return;
  }
  bar.classList.remove("is-indeterminate");
  const pct = Math.max(0, Math.min(100, d.percent || 0));
  const parts = [];
  if (d.speed && d.speed !== "—") parts.push(d.speed);
  if (d.eta && d.eta !== "—") parts.push(t("remaining", { eta: d.eta }));
  setProgress(pct, parts.join(" · ") || t("downloading"));
}

function onFinished(d) {
  leaveDownloadingUI();
  $("#progress-bar").classList.remove("is-indeterminate");
  setProgress(100, t("done_check"));
  setStatus(t("dl_complete_status"));
  const folder = d.folder || d.path || "";
  appendLog("[Loki] → " + folder);
  showDialog({
    kind: "success",
    title: t("dlg_finished_title"),
    text: folder ? t("dlg_finished_text", { folder }) : t("dlg_saved_generic"),
    actionLabel: folder ? t("open_folder") : null,
    onAction: folder ? () => whenReady(() => api().open_folder(folder)) : null,
  });
}

function onError(msg) {
  leaveDownloadingUI();
  setProgress(0, t("error_progress"));
  setStatus(t("dl_error_status"));
  showDownloadError(msg);
}

function onCancelled() {
  leaveDownloadingUI();
  setProgress(0, t("cancelled_progress"));
  setStatus(t("cancelled_status"));
}

/* ---------- Settings ---------- */
function wireSettings() {
  $("#set-language").addEventListener("change", () => {
    const v = $("#set-language").value;
    whenReady(() => api().set_setting("language", v));
    applyLanguage(v);
  });

  $("#btn-browse").addEventListener("click", () => whenReady(async () => {
    const path = await api().choose_folder();
    if (path) $("#set-path").value = path;
  }));
  $("#btn-open").addEventListener("click", () => whenReady(() => api().open_folder()));

  bindSetting("#set-type", "default_type", (v) => setKind(v));
  bindSetting("#set-container", "video_container", (v) => { $("#sel-container").value = v; });
  bindSetting("#set-codec", "audio_codec", (v) => { $("#sel-codec").value = v; });
  bindSetting("#set-abr", "audio_quality", (v) => { $("#sel-abr").value = v; });
  bindSetting("#set-cookies", "cookies_browser", null);

  $("#btn-cookies-import").addEventListener("click", () => whenReady(async () => {
    const res = await api().import_cookies();
    if (res.ok) {
      refreshCookiesStatus();
      showDialog({ kind: "success", title: t("cookies_import_ok_title"), text: t("cookies_import_ok_text") });
    } else if (res.code) {
      showDialog({ kind: "error", title: t("cookies_import_fail_title"), text: t(res.code) });
    } else if (res.error) {
      showDialog({ kind: "error", title: t("cookies_import_fail_title"), text: res.error });
    }
  }));

  $("#btn-cookies-clear").addEventListener("click", () => whenReady(async () => {
    await api().clear_cookies();
    refreshCookiesStatus();
  }));

  $("#btn-ffmpeg").addEventListener("click", () => whenReady(() => {
    $("#btn-ffmpeg").disabled = true;
    setFfmpegStatus(t("ff_progress", { pct: 0 }), "missing");
    api().download_ffmpeg();
  }));

  $("#btn-update-ytdlp").addEventListener("click", () => whenReady(() => {
    $("#btn-update-ytdlp").disabled = true;
    setEngineStatus(t("engine_updating"), "busy");
    api().update_ytdlp();
  }));
}

function bindSetting(sel, key, apply) {
  $(sel).addEventListener("change", () => {
    const v = $(sel).value;
    whenReady(() => api().set_setting(key, v));
    if (apply) apply(v);
  });
}

function loadSettings() {
  api().get_settings().then((s) => {
    applyLanguage(s.language || "en");
    $("#set-language").value = s.language || "en";
    $("#set-path").value = s.download_path || "";
    $("#set-type").value = s.default_type || "video";
    $("#set-container").value = s.video_container || "mp4";
    $("#set-codec").value = s.audio_codec || "mp3";
    $("#set-abr").value = s.audio_quality || "192";
    $("#set-cookies").value = s.cookies_browser || "";
    // mirror onto the download tab
    setKind(s.default_type || "video");
    $("#sel-container").value = s.video_container || "mp4";
    $("#sel-codec").value = s.audio_codec || "mp3";
    $("#sel-abr").value = s.audio_quality || "192";
  });
}

/* ---------- Cookies (encrypted store) ---------- */
function refreshCookiesStatus() {
  api().cookies_status().then((s) => {
    const on = !!(s && s.secured);
    const pill = $("#cookies-file-status");
    pill.textContent = on ? t("cookies_loaded") : t("cookies_not_loaded");
    pill.className = "pill" + (on ? " on" : "");
    $("#btn-cookies-clear").hidden = !on;
    $("#btn-cookies-import").textContent = on ? t("cookies_change") : t("cookies_import");
  });
}

/* ---------- FFmpeg ---------- */
function checkFfmpeg() {
  api().check_ffmpeg().then((ok) => {
    state.ffmpegAvailable = !!ok;
    renderFfmpegStatus();
    if (!ok) openFfmpegModal();   // hard gate on startup
    api().check_app_update();     // background — always after the FFmpeg check
  });
}

function renderFfmpegStatus() {
  if (state.ffmpegAvailable === null) return;
  if (state.ffmpegAvailable) {
    setFfmpegStatus(t("ffmpeg_ready"), "ok");
    $("#btn-ffmpeg").hidden = true;
  } else {
    setFfmpegStatus(t("ffmpeg_missing"), "missing");
    $("#btn-ffmpeg").hidden = false;
  }
}

function wireFfmpegModal() {
  $("#modal-yes").addEventListener("click", () => whenReady(startFfmpegDownload));
  $("#modal-no").addEventListener("click", denyFfmpeg);
}

function openFfmpegModal() {
  playNotify();
  state.ffmpegModalOpen = true;
  $("#modal-title").textContent = t("ff_modal_title");
  $("#modal-text").textContent = t("ff_modal_text");
  $("#modal-progress").hidden = true;
  $("#modal-yes").hidden = false; $("#modal-yes").disabled = false; $("#modal-yes").textContent = t("ff_modal_yes");
  $("#modal-no").hidden = false; $("#modal-no").disabled = false; $("#modal-no").textContent = t("ff_modal_no");
  $("#ffmpeg-modal").hidden = false;
}

function startFfmpegDownload() {
  $("#modal-progress").hidden = false;
  $("#modal-yes").disabled = true;
  $("#modal-no").disabled = true;
  setModalProgress(0, t("ff_progress", { pct: 0 }));
  setFfmpegStatus(t("ff_progress", { pct: 0 }), "missing");
  api().download_ffmpeg();
}

function denyFfmpeg() {
  $("#modal-title").textContent = t("ff_deny_title");
  $("#modal-text").textContent = t("ff_deny_text");
  $("#modal-progress").hidden = true;
  $("#modal-yes").hidden = true;
  $("#modal-no").hidden = true;
  setTimeout(() => whenReady(() => api().quit_app()), 1800);
}

function onFfmpegProgress(d) {
  const pct = d.percent || 0;
  const label = t("ff_progress", { pct });
  if (state.ffmpegModalOpen) setModalProgress(pct, label);
  else setStatus(label);
}

function onFfmpegDone(d) {
  $("#btn-ffmpeg").disabled = false;
  if (d.ok) {
    state.ffmpegAvailable = true;
    renderFfmpegStatus();
    setStatus(t("ff_ready_status"));
    if (state.ffmpegModalOpen) {
      setModalProgress(100, t("ff_done"));
      state.ffmpegModalOpen = false;
      setTimeout(() => {
        $("#ffmpeg-modal").hidden = true;
        if (state.updatePending) { state.updatePending = false; openUpdateModal(); }
      }, 500);
    }
  } else {
    const detail = d.detail === "ffmpeg_not_in_zip" ? t("ff_notinzip") : (d.detail || t("unknown_error"));
    setFfmpegStatus(detail, "missing");
    setStatus(t("ff_fail_status"));
    if (state.ffmpegModalOpen) {
      $("#modal-progress").hidden = true;
      $("#modal-title").textContent = t("ff_fail_title");
      $("#modal-text").textContent = t("ff_fail_text", { detail });
      $("#modal-yes").hidden = false; $("#modal-yes").disabled = false; $("#modal-yes").textContent = t("ff_retry");
      $("#modal-no").hidden = false; $("#modal-no").disabled = false;
    }
  }
}

function setModalProgress(pct, label) {
  $("#modal-bar").style.width = Math.max(0, Math.min(100, pct)) + "%";
  if (label !== undefined) $("#modal-progress-text").textContent = label;
}

function setFfmpegStatus(text, cls) {
  const el = $("#ffmpeg-status");
  el.textContent = text;
  el.className = "muted small " + (cls || "");
}

/* ---------- App update (info only, no auto-update) ---------- */
function wireUpdateModal() {
  $("#update-badge").addEventListener("click", openUpdateModal);
  $("#update-later").addEventListener("click", closeUpdateModal);
  $("#update-get").addEventListener("click", () => {
    const page = state.update && state.update.page;
    if (page) whenReady(() => api().open_url(page));
    closeUpdateModal();
  });
}

function onAppUpdate(d) {
  if (!d || !d.ok || !d.available) return;
  state.update = d;
  renderUpdateBadge();
  appendLog(`[Loki] ${t("upd_status", { v: d.latest })}`);
  // The FFmpeg dialog is a hard gate — queue behind it.
  if (state.ffmpegModalOpen) state.updatePending = true;
  else openUpdateModal();
}

function renderUpdateBadge() {
  const badge = $("#update-badge");
  const u = state.update;
  if (!u || !u.available) { badge.hidden = true; return; }
  badge.textContent = t("upd_badge", { v: u.latest });
  badge.title = t("upd_badge_hint");
  badge.hidden = false;
}

function openUpdateModal() {
  const u = state.update;
  if (!u) return;
  playNotify();
  $("#update-title").textContent = t("upd_title");
  $("#update-text").textContent = t("upd_text", { name: u.name || "Loki" });
  $("#update-current").textContent = "v" + u.current;
  $("#update-latest").textContent = "v" + u.latest;

  const meta = $("#update-meta");
  const date = formatReleaseDate(u.released_at);
  meta.textContent = date ? t("upd_released", { date }) : "";
  meta.hidden = !date;

  $("#update-link").textContent = u.page || "";
  $("#update-get").textContent = t("upd_get");
  $("#update-later").textContent = t("upd_later");
  $("#update-modal").hidden = false;
  if (!state.downloading) setStatus(t("upd_status", { v: u.latest }));
}

function closeUpdateModal() { $("#update-modal").hidden = true; }

function formatReleaseDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(document.documentElement.lang || "en", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

/* ---------- yt-dlp engine ---------- */
let engineFrozen = false;

function loadEngineInfo() {
  api().get_engine_info().then((e) => {
    engineFrozen = !!e.frozen;
    state.engine = { version: e.version || "?", frozen: engineFrozen, update: undefined };
    renderEngineStatus();
    api().check_ytdlp_update().then((u) => {
      state.engine.update = u || { ok: false };
      renderEngineStatus();
    });
  });
}

function renderEngineStatus() {
  const e = state.engine;
  if (!e) return;
  if (e.update === undefined) {
    setEngineStatus(t("engine_checking", { v: e.version }), "busy");
    return;
  }
  const u = e.update;
  if (!u || !u.ok) {
    setEngineStatus(t("engine_version", { v: e.version }), "");
    return;
  }
  if (u.outdated) {
    setEngineStatus(t("engine_update_avail", { cur: u.current, latest: u.latest }), "busy");
    $("#btn-update-ytdlp").hidden = engineFrozen;   // pip update unavailable in the exe
  } else {
    setEngineStatus(t("engine_current", { v: u.current }), "ok");
    $("#btn-update-ytdlp").hidden = true;
  }
}

function onYtdlpUpdateDone(d) {
  $("#btn-update-ytdlp").disabled = false;
  if (d.ok) {
    $("#btn-update-ytdlp").hidden = true;
    setEngineStatus(d.code ? t(d.code) : "", "ok");
    setStatus(t("ytdlp_updated_status"));
  } else {
    const msg = d.code ? t(d.code) : t("engine_update_err", { detail: d.detail || "" });
    setEngineStatus(msg, "err");
  }
}

function setEngineStatus(text, cls) {
  const el = $("#engine-status");
  el.textContent = text;
  el.className = "muted small " + (cls || "");
}

/* ---------- Console ---------- */
function wireConsole() {
  $("#btn-clear").addEventListener("click", () => { $("#console").textContent = ""; });
  $("#btn-copy").addEventListener("click", copyConsole);
}

function copyConsole() {
  const text = $("#console").textContent || "";
  if (!text) { setStatus(t("console_empty")); return; }
  const done = () => {
    const btn = $("#btn-copy");
    const prev = t("copy");
    btn.textContent = t("copied");
    setTimeout(() => (btn.textContent = prev), 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

function appendLog(line) {
  if (!line) return;
  const c = $("#console");
  c.textContent += (c.textContent ? "\n" : "") + line;
  c.scrollTop = c.scrollHeight;
}

/* ---------- UI helpers ---------- */
function setProgress(pct, label) {
  $("#progress-bar").style.width = pct + "%";
  $("#progress-percent").textContent = Math.round(pct) + "%";
  if (label !== undefined) $("#progress-label").textContent = label;
}
function setStatus(text) { $("#status").textContent = text; }

/* ---------- Message dialog ---------- */
let dialogAction = null;

function wireDialog() {
  $("#msg-ok").addEventListener("click", closeDialog);
  $("#msg-action").addEventListener("click", () => {
    if (dialogAction) dialogAction();
    closeDialog();
  });
}
function closeDialog() { $("#msg-modal").hidden = true; }

function showDialog({ title, text, kind = "info", actionLabel = null, onAction = null }) {
  playNotify();
  const icon = $("#msg-icon");
  icon.className = "msg-icon " + kind;
  icon.textContent = kind === "success" ? "✓" : kind === "error" ? "✕" : "ℹ";
  $("#msg-title").textContent = title || "";
  $("#msg-text").textContent = text || "";
  $("#msg-ok").textContent = t("dlg_ok");
  const actBtn = $("#msg-action");
  if (actionLabel) {
    actBtn.textContent = actionLabel;
    actBtn.hidden = false;
    dialogAction = onAction;
  } else {
    actBtn.hidden = true;
    dialogAction = null;
  }
  $("#msg-modal").hidden = false;
}

function stripAnsi(s) {
  return String(s).replace(/\x1b?\[[0-9;]*m/g, "");
}

function showDownloadError(msg) {
  const raw = stripAnsi(msg || "");

  // Cookie DB locked because the browser is running.
  const cookieLocked = /permission denied[\s\S]*cookies|could not copy[\s\S]*cookie|cookies\.sqlite|cookie database/i.test(raw);
  if (cookieLocked) {
    showDialog({ kind: "error", title: t("dlg_cookie_locked_title"), text: t("dlg_cookie_locked_text") });
    return;
  }

  // Video needs a signed-in session (e.g. age restriction).
  const needsCookies = /confirm your age|age-restricted|sign in|--cookies|login required|private video|members-only/i.test(raw);
  if (needsCookies) {
    showDialog({ kind: "error", title: t("dlg_needs_cookies_title"), text: t("dlg_needs_cookies_text") });
    return;
  }

  showDialog({ kind: "error", title: t("dlg_error_title"), text: cleanError(raw) });
}

function cleanError(msg) {
  let m = stripAnsi(msg).replace(/^ERROR:\s*/i, "").trim();
  const cut = m.search(/\s*(Use --cookies|See https?:\/\/|https?:\/\/)/i);
  if (cut > 0) m = m.slice(0, cut).trim();
  return m || t("unknown_error");
}
