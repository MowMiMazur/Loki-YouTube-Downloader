/* ============================================================
   Loki — custom dropdowns.

   Every <select class="select"> keeps living in the DOM (hidden) and
   stays the single source of truth: .value, new Option(), innerHTML,
   the "change" event and the [data-when] hidden toggling all keep
   working exactly as before. This file only draws a themed listbox on
   top of it and mirrors both ways.
   ============================================================ */
"use strict";

(function () {
  const CARET =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6"/></svg>';

  const MENU_MAX_H = 288;   // px — roughly 7 rows
  const MENU_GAP = 4;       // px between trigger and menu
  const VIEW_MARGIN = 8;    // px kept free at the viewport edge

  let openDd = null;        // the dropdown currently expanded
  let scrollGuard = 0;      // ignore the scroll our own scrollIntoView causes

  /* ---------- Dropdown ---------- */
  class Dropdown {
    constructor(sel) {
      this.sel = sel;
      this.items = [];
      this.active = -1;
      this.typed = "";
      this.typedAt = 0;

      // wrapper takes the select's place in the layout
      this.wrap = document.createElement("div");
      this.wrap.className = "select-wrap";
      sel.parentNode.insertBefore(this.wrap, sel);
      this.wrap.appendChild(sel);

      this.btn = document.createElement("button");
      this.btn.type = "button";
      this.btn.className = "select-btn";
      this.btn.setAttribute("role", "combobox");
      this.btn.setAttribute("aria-haspopup", "listbox");
      this.btn.setAttribute("aria-expanded", "false");
      this.btn.innerHTML = '<span class="select-value">—</span><span class="select-caret">' + CARET + "</span>";
      this.label = this.btn.firstElementChild;
      this.wrap.appendChild(this.btn);

      this.menu = document.createElement("div");
      this.menu.className = "select-menu";
      this.menu.setAttribute("role", "listbox");
      this.menu.hidden = true;

      if (sel.id) {
        this.btn.id = sel.id + "-btn";
        this.menu.id = sel.id + "-menu";
        this.btn.setAttribute("aria-controls", this.menu.id);
        const lab = document.querySelector('label[for="' + sel.id + '"]');
        if (lab) {
          if (!lab.id) lab.id = sel.id + "-label";
          this.btn.setAttribute("aria-labelledby", lab.id);
          lab.addEventListener("click", (e) => { e.preventDefault(); this.btn.focus(); });
        }
      }

      this.wireTrigger();
      this.watchSelect();
      this.syncState();
      this.render();
    }

    /* ----- mirroring the native select ----- */

    watchSelect() {
      // options replaced / relabelled (showInfo, applyStaticI18n, updateBestOption)
      // and the hidden/disabled attributes flipped by [data-when]
      new MutationObserver(() => { this.syncState(); this.render(); }).observe(this.sel, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["hidden", "disabled"],
      });

      // `sel.value = x` fires no event — hook the property on this instance
      const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      const dd = this;
      Object.defineProperty(this.sel, "value", {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, v); dd.render(); },
      });

      this.sel.addEventListener("change", () => this.render());
    }

    syncState() {
      this.wrap.hidden = this.sel.hidden;
      const off = this.sel.disabled;
      this.btn.disabled = off;
      this.wrap.classList.toggle("is-disabled", off);
      if (off && openDd === this) this.close();
    }

    /* ----- drawing ----- */

    render() {
      const opts = Array.from(this.sel.options);
      const idx = this.sel.selectedIndex;
      this.label.textContent = idx >= 0 && opts[idx] ? opts[idx].textContent.trim() : "—";
      this.label.classList.toggle("is-empty", idx < 0);

      this.menu.textContent = "";
      this.items = opts.map((o, i) => {
        const item = document.createElement("div");
        item.className = "select-option";
        item.setAttribute("role", "option");
        item.id = (this.sel.id || "sel") + "-opt-" + i;
        item.dataset.index = String(i);
        item.textContent = o.textContent.trim();
        if (o.disabled) item.classList.add("is-disabled");
        if (i === idx) {
          item.classList.add("is-selected");
          item.setAttribute("aria-selected", "true");
        } else {
          item.setAttribute("aria-selected", "false");
        }
        this.menu.appendChild(item);
        return item;
      });

      if (openDd === this) {
        this.highlight(this.sel.selectedIndex);
        this.place();
      }
    }

    /* ----- open / close ----- */

    wireTrigger() {
      this.btn.addEventListener("click", () => (openDd === this ? this.close() : this.open()));
      this.btn.addEventListener("keydown", (e) => this.onKey(e));

      this.menu.addEventListener("mousemove", (e) => {
        const item = e.target.closest(".select-option");
        if (item && !item.classList.contains("is-disabled")) this.highlight(+item.dataset.index);
      });
      this.menu.addEventListener("click", (e) => {
        const item = e.target.closest(".select-option");
        if (item && !item.classList.contains("is-disabled")) this.commit(+item.dataset.index);
      });
      // keep focus on the trigger so keyboard control never breaks
      this.menu.addEventListener("mousedown", (e) => e.preventDefault());
    }

    open() {
      if (this.btn.disabled || !this.items.length) return;
      if (openDd) openDd.close();
      // a trigger sitting half-way out of .content would push the menu off-screen
      this.btn.scrollIntoView({ block: "nearest" });
      scrollGuard = Date.now() + 150;
      openDd = this;
      this.menu.hidden = false;
      document.body.appendChild(this.menu);
      this.btn.setAttribute("aria-expanded", "true");
      this.wrap.classList.add("is-open");
      this.highlight(this.sel.selectedIndex);
      this.place();
      const on = this.items[this.active];
      if (on) on.scrollIntoView({ block: "nearest" });
    }

    close() {
      if (openDd !== this) return;
      openDd = null;
      this.menu.hidden = true;
      this.menu.classList.remove("is-up");
      if (this.menu.parentNode) this.menu.parentNode.removeChild(this.menu);
      this.btn.setAttribute("aria-expanded", "false");
      this.btn.removeAttribute("aria-activedescendant");
      this.wrap.classList.remove("is-open");
      this.active = -1;
    }

    place() {
      const r = this.btn.getBoundingClientRect();
      const m = this.menu;
      m.style.maxHeight = "none";
      m.style.width = r.width + "px";

      const natural = m.offsetHeight;
      const below = window.innerHeight - r.bottom - MENU_GAP - VIEW_MARGIN;
      const above = r.top - MENU_GAP - VIEW_MARGIN;
      const up = natural > below && above > below;
      const room = Math.max(up ? above : below, 0);
      const h = Math.min(natural, MENU_MAX_H, Math.max(room, 0));

      m.style.maxHeight = h + "px";
      m.style.left = Math.max(VIEW_MARGIN, Math.min(r.left, window.innerWidth - r.width - VIEW_MARGIN)) + "px";
      m.style.top = Math.max(
        VIEW_MARGIN,
        Math.min(up ? r.top - h - MENU_GAP : r.bottom + MENU_GAP, window.innerHeight - h - VIEW_MARGIN)
      ) + "px";
      m.classList.toggle("is-up", up);
    }

    /* ----- selection ----- */

    highlight(i) {
      this.items.forEach((el) => el.classList.remove("is-active"));
      this.active = i;
      const el = this.items[i];
      if (!el) { this.btn.removeAttribute("aria-activedescendant"); return; }
      el.classList.add("is-active");
      this.btn.setAttribute("aria-activedescendant", el.id);
    }

    move(step) {
      const n = this.sel.options.length;
      if (!n) return;
      let i = this.active;
      for (let k = 0; k < n; k++) {
        i = (i + step + n) % n;
        if (!this.sel.options[i].disabled) break;
      }
      this.highlight(i);
      const el = this.items[i];
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    commit(i) {
      const opt = this.sel.options[i];
      const changed = opt && this.sel.selectedIndex !== i;
      if (opt) this.sel.selectedIndex = i;
      this.close();
      this.render();
      if (changed) this.sel.dispatchEvent(new Event("change", { bubbles: true }));
      this.btn.focus();
    }

    /* pick without opening — matches native arrow-key behaviour */
    step(dir) {
      const n = this.sel.options.length;
      if (!n) return;
      let i = this.sel.selectedIndex < 0 ? (dir > 0 ? -1 : n) : this.sel.selectedIndex;
      for (let k = 0; k < n; k++) {
        i += dir;
        if (i < 0 || i >= n) return;
        if (!this.sel.options[i].disabled) break;
      }
      if (i !== this.sel.selectedIndex) this.commit(i);
    }

    search(ch) {
      const now = Date.now();
      this.typed = now - this.typedAt > 800 ? ch : this.typed + ch;
      this.typedAt = now;

      // repeating one letter cycles through the items starting with it
      const same = this.typed.length > 1 && [...this.typed].every((c) => c === this.typed[0]);
      const q = same ? this.typed[0] : this.typed;

      const opts = Array.from(this.sel.options);
      if (!opts.length) return;
      const cur = openDd === this ? this.active : this.sel.selectedIndex;
      const from = q.length > 1 && !same ? Math.max(cur, 0) : cur + 1;

      for (let k = 0; k < opts.length; k++) {
        const i = ((from + k) % opts.length + opts.length) % opts.length;
        const o = opts[i];
        if (!o.disabled && o.textContent.trim().toLowerCase().startsWith(q)) {
          if (openDd === this) { this.highlight(i); this.items[i].scrollIntoView({ block: "nearest" }); }
          else this.commit(i);
          return;
        }
      }
    }

    onKey(e) {
      const isOpen = openDd === this;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (isOpen) this.move(1); else if (e.altKey) this.open(); else this.step(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isOpen) this.move(-1); else if (e.altKey) this.open(); else this.step(-1);
          break;
        case "Home":
          if (isOpen) { e.preventDefault(); this.highlight(-1); this.move(1); }
          break;
        case "End":
          if (isOpen) { e.preventDefault(); this.highlight(this.sel.options.length); this.move(-1); }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (isOpen) this.commit(this.active); else this.open();
          break;
        case "Escape":
          if (isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); }
          break;
        case "Tab":
          this.close();
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            this.search(e.key.toLowerCase());
          }
      }
    }
  }

  /* ---------- global wiring ---------- */
  function closeOpen() { if (openDd) openDd.close(); }

  document.addEventListener("pointerdown", (e) => {
    if (!openDd) return;
    if (!openDd.menu.contains(e.target) && !openDd.wrap.contains(e.target)) closeOpen();
  }, true);
  window.addEventListener("scroll", (e) => {
    if (!openDd) return;
    if (openDd.menu.contains(e.target)) return;          // scrolling the menu itself
    if (Date.now() < scrollGuard) { openDd.place(); return; }
    closeOpen();
  }, true);
  window.addEventListener("resize", closeOpen);
  window.addEventListener("blur", closeOpen);
  document.addEventListener("focusin", (e) => {
    if (openDd && !openDd.wrap.contains(e.target)) closeOpen();
  });

  function enhanceAll(root) {
    (root || document).querySelectorAll("select.select:not([data-dd])").forEach((sel) => {
      sel.setAttribute("data-dd", "1");
      new Dropdown(sel);
    });
  }

  // runs after app.js' own DOMContentLoaded handler (script order), so the
  // initial i18n pass and setKind() are already reflected
  document.addEventListener("DOMContentLoaded", () => enhanceAll());
  window.LokiDropdown = { enhance: enhanceAll };
})();
