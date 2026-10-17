(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const native = window.native || null;
  const hasFSA = !native && "showOpenFilePicker" in window;
  if (native) document.body.classList.add("native");
  const work = $("work");
  const stMsg = $("stMsg");
  const fnameEl = $("fname");
  const host = $("editorHost");
  const BASE_SIZE = 16;

  // =====================================================================
  // Preferences
  // =====================================================================
  const PREF_KEY = "edith.prefs",
    SESSION_KEY = "edith.session",
    LEGACY_PREF = "mdeditor.prefs",
    LEGACY_DRAFT = "mdeditor.draft";
  function load(k) {
    try {
      return JSON.parse(localStorage.getItem(k)) || null;
    } catch (e) {
      return null;
    }
  }
  function store(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      if (k === SESSION_KEY && window.__edithWarn) window.__edithWarn();
      return false;
    }
  }
  const APP_VERSION = "3.7.4";
  const DEFAULTS = {
    width: "normal",
    seenVersion: "",
    theme: "edith",
    mode: "wysiwyg",
    side: true,
    tab: "outline",
    size: BASE_SIZE,
    sideW: 260,
    mdsplit: 50,
    mdPreview: true,
    autosave: true,
    autosaveDelay: 2,
    verMinutes: 10,
    verMax: 150,
    capMB: 250,
    spell: true,
    marginNotes: false,
    noteSort: "page",
  };
  const prefs = Object.assign({}, DEFAULTS, load(PREF_KEY) || load(LEGACY_PREF) || {});
  if (prefs.theme === "clean") prefs.theme = "edith";
  const savePrefs = () => store(PREF_KEY, prefs);

  const THEMES = [
    { id: "edith", name: "Edith", sub: "Parchment, cream and sage", bg: "#faf7ef", ink: "#3e372e", accent: "#5e8a68" },
    { id: "dusk", name: "Dusk", sub: "Edith after dark — warm, never black", bg: "#3a352e", ink: "#ece4d2", accent: "#8eb092" },
    { id: "natural", name: "Natural", sub: "Warm paper, olive, Lora", bg: "#faf6ee", ink: "#2a2722", accent: "#5f7a3d" },
    { id: "organic", name: "Organic", sub: "Deep moss, Fraunces", bg: "#1f261f", ink: "#e8e3d6", accent: "#a3c47c" },
    { id: "academic", name: "Academic", sub: "Ivory, oxblood, Garamond", bg: "#fbfaf5", ink: "#1f2430", accent: "#7a2e2e" },
    { id: "focused", name: "Focused", sub: "Quiet charcoal, Inter", bg: "#303030", ink: "#d8d8d8", accent: "#bdbdbd" },
    { id: "matrix", name: "Matrix", sub: "Phosphor green on black", bg: "#040804", ink: "#4dff7a", accent: "#00ff6a" },
  ];

  // =====================================================================
  // Small helpers
  // =====================================================================
  let msgTimer = null,
    msgFade = null;
  function message(text, cls) {
    stMsg.textContent = text;
    stMsg.className = "msg " + (cls || "");
    stMsg.style.animation = "none";
    void stMsg.offsetWidth;
    stMsg.style.animation = "";
    clearTimeout(msgTimer);
    clearTimeout(msgFade);
    if (cls !== "err") {
      msgFade = setTimeout(() => stMsg.classList.add("fade"), 3650);
      msgTimer = setTimeout(() => {
        stMsg.textContent = "";
        stMsg.classList.remove("fade");
      }, 4000);
    }
  }
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const setText = (el, v) => {
    if (el.textContent !== v) el.textContent = v;
  };
  // A quiet confirmation on a button (it cross-fades to its second label and back)
  function flashBtn(b) {
    if (!b) return;
    b.classList.add("did");
    clearTimeout(b._ft);
    b._ft = setTimeout(() => b.classList.remove("did"), 1500);
  }
  function openModal(id) {
    const m = $(id);
    clearTimeout(m._ct);
    m.classList.remove("closing");
    m.classList.add("on");
    const f = m.querySelector("textarea, input[type=text], input[type=url]");
    if (f) setTimeout(() => f.focus(), 30);
  }
  // Dialogs fade out instead of vanishing
  function hideModal(m) {
    if (!m || !m.classList.contains("on") || m.classList.contains("closing")) return;
    if (reduceMotion()) {
      m.classList.remove("on");
      return;
    }
    m.classList.add("closing");
    clearTimeout(m._ct);
    m._ct = setTimeout(() => m.classList.remove("on", "closing"), 150);
  }
  function closeModals() {
    document.querySelectorAll(".modal.on").forEach((m) => {
      if (m.id !== "mBusy") hideModal(m);
    });
    closeMenus();
  }
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => hideModal(b.closest(".modal"))));
  document.querySelectorAll(".modal").forEach((m) =>
    m.addEventListener("mousedown", (e) => {
      if (e.target === m && m.id !== "mBusy") hideModal(m);
    }),
  );
  function confirmBox(title, text, okLabel) {
    return new Promise((res) => {
      $("confirmTitle").textContent = title;
      $("confirmText").textContent = text;
      $("confirmOk").textContent = okLabel || "OK";
      const okBtn = $("confirmOk"),
        cancelBtn = $("mConfirm").querySelector("[data-close]");
      const ok = () => {
        cleanup();
        res(true);
      };
      const cancel = () => {
        cleanup();
        res(false);
      };
      function cleanup() {
        okBtn.removeEventListener("click", ok);
        cancelBtn.removeEventListener("click", cancel);
        hideModal($("mConfirm"));
      }
      okBtn.addEventListener("click", ok);
      cancelBtn.addEventListener("click", cancel);
      openModal("mConfirm");
    });
  }
  function closeMenus() {
    document.querySelectorAll(".menu").forEach((m) => {
      m.hidden = true;
    });
  }
  function bindMenu(btnId, menuId) {
    $(btnId).addEventListener("click", (e) => {
      e.stopPropagation();
      const m = $(menuId);
      const open = m.hidden;
      closeMenus();
      m.hidden = !open;
    });
  }
  document.addEventListener("click", closeMenus);
  bindMenu("btnFileMenu", "fileMenu");
  bindMenu("btnHeading", "headingMenu");
  bindMenu("btnTheme", "themeMenu");
  bindMenu("btnMore", "moreMenu");
  const relTime = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24);
    if (d < 7) return d + (d === 1 ? " day ago" : " days ago");
    return new Date(t).toLocaleDateString([], { dateStyle: "medium" });
  };
  const fmtDate = (t) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { timeStyle: "short" });
  const fmtSize = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const baseName = (p) => (p || "").split("/").pop();
  const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  const ensureExt = (n) => (/\.(md|markdown|txt)$/i.test(n) ? n : n.replace(/\.(docx?|pdf|html?|rtf)$/i, "") + ".md");
  const uid = () => Math.random().toString(36).slice(2, 10);

  // =====================================================================
  // IndexedDB — versions & recent files
  // =====================================================================
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("mdeditor", 3);
      r.onupgradeneeded = (ev) => {
        const d = r.result;
        const tx = r.transaction;
        if (!d.objectStoreNames.contains("versions")) {
          const v = d.createObjectStore("versions", { keyPath: "id", autoIncrement: true });
          v.createIndex("file", "file");
        }
        if (!d.objectStoreNames.contains("recent")) d.createObjectStore("recent", { keyPath: "name" });
        if (!d.objectStoreNames.contains("notes")) d.createObjectStore("notes", { keyPath: "key" });
        if (!d.objectStoreNames.contains("meta")) {
          const m = d.createObjectStore("meta", { keyPath: "id" });
          m.createIndex("file", "file");
          if (ev.oldVersion >= 1) {
            const cur = tx.objectStore("versions").openCursor();
            cur.onsuccess = () => {
              const c = cur.result;
              if (c) {
                const v = c.value;
                m.put({ id: v.id, file: v.file, at: v.at, label: v.label, size: v.text.length });
                c.continue();
              }
            };
          }
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(storeName, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  function cursorAll(storeName, index, range, pick) {
    return db().then(
      (d) =>
        new Promise((res) => {
          const out = [];
          const src = d.transaction(storeName).objectStore(storeName);
          const req = (index ? src.index(index) : src).openCursor(range || null);
          req.onsuccess = () => {
            const c = req.result;
            if (c) {
              out.push(pick(c.value));
              c.continue();
            } else res(out);
          };
          req.onerror = () => res(out);
        }),
    );
  }
  const listVersions = async () => (await cursorAll("meta", "file", IDBKeyRange.only(fileKey()), (v) => v)).sort((a, b) => b.at - a.at);
  const allVersions = () => cursorAll("meta", null, null, (v) => v);
  const getVersion = (id) => idb("versions", "readonly", (s) => s.get(id));
  async function deleteVersion(id) {
    const d = await db();
    await new Promise((res) => {
      const tx = d.transaction(["versions", "meta"], "readwrite");
      tx.objectStore("versions").delete(id);
      tx.objectStore("meta").delete(id);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }
  async function addVersion(rec) {
    const d = await db();
    await new Promise((res) => {
      const tx = d.transaction(["versions", "meta"], "readwrite");
      const req = tx.objectStore("versions").add(rec);
      req.onsuccess = () => tx.objectStore("meta").put({ id: req.result, file: rec.file, at: rec.at, label: rec.label, size: rec.text.length });
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }
  async function enforceCaps() {
    const all = (await allVersions()).sort((a, b) => b.at - a.at);
    const perFile = {};
    const toDelete = new Set();
    for (const v of all) {
      perFile[v.file] = (perFile[v.file] || 0) + 1;
      if (perFile[v.file] > prefs.verMax) toDelete.add(v.id);
    }
    let total = all.filter((v) => !toDelete.has(v.id)).reduce((s, v) => s + v.size, 0);
    const cap = prefs.capMB * 1024 * 1024;
    if (total > cap) {
      // oldest automatic versions go first, then oldest of anything
      const order = all
        .filter((v) => !toDelete.has(v.id))
        .sort((a, b) => ((a.label === "Auto") === (b.label === "Auto") ? a.at - b.at : a.label === "Auto" ? -1 : 1));
      for (const v of order) {
        if (total <= cap) break;
        toDelete.add(v.id);
        total -= v.size;
      }
    }
    for (const id of toDelete) await deleteVersion(id);
    return total;
  }
  async function snapshot(label, force) {
    const text = getDoc();
    if (!force && text === T.lastSnapshotText) return false;
    if (!text.trim()) return false;
    T.lastSnapshotText = text;
    await addVersion({ file: fileKey(), at: Date.now(), label, text });
    await enforceCaps();
    renderHistory();
    return true;
  }
  async function rememberRecent(name, ref) {
    try {
      await idb("recent", "readwrite", (s) =>
        s.put({ name: ref && ref.path ? ref.path : name, label: name, handle: (ref && ref.handle) || null, path: (ref && ref.path) || null, at: Date.now() }),
      );
    } catch (e) {}
    pushRecentToMenu();
  }
  async function pushRecentToMenu() {
    if (!native || !native.setRecent) return;
    try {
      const rs = await listRecent();
      native.setRecent(rs.filter((r) => r.path).map((r) => ({ label: r.label || r.name, path: r.path })));
    } catch (e) {}
  }
  const listRecent = async () => ((await idb("recent", "readonly", (s) => s.getAll())) || []).sort((a, b) => b.at - a.at).slice(0, 15);

  // =====================================================================
  // Tabs — each tab owns an editor instance and its document state
  // =====================================================================
  const tabs = [];
  let T = null; // T = active tab
  const editor = { get: () => T.editor }; // for readability below we use T.editor directly
  const isWW = () => !!T && T.editor.isWysiwygMode();
  const wwPM = () => T.el.querySelector(".toastui-editor-ww-container .ProseMirror");
  const mdPM = () => T.el.querySelector(".toastui-editor-md-container .toastui-editor .ProseMirror");
  const keyOf = (tab) =>
    tab.fileRef && tab.fileRef.path ? tab.fileRef.path : tab.fileRef && tab.fileRef.handle ? "name:" + tab.name.trim().toLowerCase() : "untitled:" + tab.id;
  const fileKey = () => keyOf(T);
  async function rekeyVersions(oldKey, newKey) {
    if (!oldKey || oldKey === newKey) return;
    const d = await db();
    await new Promise((res) => {
      const tx = d.transaction(["versions", "meta"], "readwrite");
      for (const st of ["versions", "meta"]) {
        const req = tx.objectStore(st).index("file").openCursor(IDBKeyRange.only(oldKey));
        req.onsuccess = () => {
          const c = req.result;
          if (c) {
            const v = c.value;
            v.file = newKey;
            c.update(v);
            c.continue();
          }
        };
      }
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }

  function createTab(opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "tabview";
    el.hidden = true;
    const mount = document.createElement("div");
    el.appendChild(mount);
    host.appendChild(el);
    const tab = {
      id: uid(),
      el,
      editor: null,
      wwView: null,
      mdView: null,
      name: opts.name || "untitled.md",
      fileRef: opts.fileRef || null,
      dirty: false,
      lastSavedText: "",
      notes: [],
      importedFrom: null,
      cachedMd: "",
      lastSnapshotText: null,
      timers: {},
      notesRev: 0,
    };
    tab.editor = new toastui.Editor({
      el: mount,
      height: "100%",
      initialEditType: opts.mode || prefs.mode,
      previewStyle: "vertical",
      hideModeSwitch: true,
      toolbarItems: [],
      usageStatistics: false,
      autofocus: false,
      placeholder: "Start writing. Paste from an AI chat, drop a file here, or press ⌘O to open one.",
      frontMatter: true,
      hooks: { addImageBlobHook: (blob, cb) => saveImage(tab, blob, cb) },
      linkAttributes: { target: "_blank", rel: "noopener" },
      events: {
        change: () => {
          if (T === tab) onChange();
          else tab.pendingChange = true;
        },
      },
    });
    tab.fileMtime = null;
    tab.wwView = tab.editor.wwEditor.view;
    tab.mdView = tab.editor.mdEditor.view;
    [tab.wwView, tab.mdView].forEach((v) => v.setProps({ decorations: (state) => noteDecorations(tab, state.doc) }));
    installTypingShortcuts(tab);
    installSmartPaste(tab);
    snapScrollSync(tab);
    ensureMdGutter(tab);
    const pmEl = tab.el.querySelector(".toastui-editor-ww-container .ProseMirror");
    if (pmEl) {
      pmEl.addEventListener(
        "scroll",
        () => {
          if (T === tab && prefs.marginNotes) positionMargin();
        },
        { passive: true },
      );
      new ResizeObserver(() => {
        if (T === tab && prefs.marginNotes) layoutMargin();
      }).observe(pmEl);
    }
    new MutationObserver(() => showImages(tab)).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    tabs.push(tab);
    return tab;
  }
  function renderTabs() {
    const strip = $("tabsScroll");
    strip.innerHTML = "";
    tabs.forEach((tab) => {
      const b = document.createElement("div");
      b.className = "tab" + (tab === T ? " active" : "") + (tab.dirty ? " dirty" : "");
      b.draggable = true;
      b.dataset.id = tab.id;
      b.title = (tab.fileRef && tab.fileRef.path) || tab.name;
      b.innerHTML = '<span class="n"></span><span class="d"></span><button class="x" title="Close tab (⌘W)">×</button>';
      b.querySelector(".n").textContent = tab.name;
      b.addEventListener("mousedown", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          closeTab(tab);
        }
      });
      b.addEventListener("click", (e) => {
        if (e.target.closest(".x")) closeTab(tab);
        else activateTab(tab);
      });
      b.addEventListener("dblclick", (e) => {
        if (e.target.closest(".x")) return;
        activateTab(tab).then(() => {
          $("renameInput").value = tab.name;
          openModal("mRename");
        });
      });
      b.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/x-tab", tab.id);
        e.dataTransfer.effectAllowed = "move";
        b.classList.add("dragging");
      });
      b.addEventListener("dragend", () => b.classList.remove("dragging"));
      b.addEventListener("dragover", (e) => {
        if (e.dataTransfer.types.includes("text/x-tab")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      b.addEventListener("drop", (e) => {
        const id = e.dataTransfer.getData("text/x-tab");
        if (!id || id === tab.id) return;
        e.preventDefault();
        e.stopPropagation();
        const from = tabs.findIndex((x) => x.id === id),
          to = tabs.indexOf(tab);
        const [moved] = tabs.splice(from, 1);
        tabs.splice(to, 0, moved);
        renderTabs();
        saveSession();
      });
      strip.appendChild(b);
    });
    const act = strip.querySelector(".tab.active");
    strip.scrollTop = 0;
    if (act) {
      const l = act.offsetLeft,
        r = l + act.offsetWidth;
      if (l < strip.scrollLeft) strip.scrollLeft = l;
      else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth;
    }
  }
  async function flushTab(tab) {
    // settle pending timers before leaving a tab so nothing is attributed to the wrong document
    if (!tab) return;
    const tm = tab.timers;
    if (tm.change) {
      clearTimeout(tm.change);
      tm.change = null;
      commitChange();
    }
    if (tm.draft) {
      clearTimeout(tm.draft);
      tm.draft = null;
      saveSession();
    }
    if (tm.autosave) {
      clearTimeout(tm.autosave);
      tm.autosave = null;
      await saveFile(false, true);
    }
  }
  const RECENT_CARDS = 6;
  // the editor fades in as Home goes (CSS: body.reveal); the class is dropped once that has played
  function revealFromHome() {
    if (reduceMotion()) return;
    const host = $("editorHost");
    const done = (e) => {
      if (e && e.animationName !== "docIn") return;
      document.body.classList.remove("reveal");
      host.removeEventListener("animationend", done);
    };
    document.body.classList.add("reveal");
    host.addEventListener("animationend", done);
    setTimeout(done, 1500);
  }
  async function recentCard(r) {
    const card = document.createElement("button");
    card.className = "rcard";
    card.title = r.path || "";
    card.setAttribute("spellcheck", "false");
    let head = "";
    if (native && r.path) {
      try {
        const rr = await native.readHead(r.path);
        if (rr.ok) head = rr.text;
      } catch (e) {}
    }
    const lines = head
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^---[\s\S]*?---\n/, "")
      .split("\n")
      .filter((l) => !/^\s*\|/.test(l) && !/^\s*(---|```)/.test(l))
      .map((l) => l.replace(/^#+\s*|[*_`>]/g, "").trim())
      .filter(Boolean);
    const title = (r.label || r.name).replace(/\.(md|markdown|txt)$/i, "");
    card.innerHTML = '<div class="thumb"><b></b><p></p></div><div class="meta"><div class="n"></div><div class="d"></div></div>';
    card.querySelector(".thumb b").textContent = lines[0] || title;
    card.querySelector(".thumb p").textContent = lines.slice(1, 7).join(" ").slice(0, 320);
    card.querySelector(".n").textContent = title;
    card.querySelector(".d").textContent = relTime(r.at);
    card.addEventListener("click", async () => {
      if (r.path || r.handle) {
        revealFromHome();
        try {
          await openFromRef(r.path ? { path: r.path } : { handle: r.handle });
        } catch (e) {
          message("Could not reopen: " + e.message, "err");
        }
      }
    });
    // the card is a button, so its remove button sits beside it in a wrapper
    const wrap = document.createElement("div");
    wrap.className = "rcard-wrap";
    wrap.dataset.key = r.name;
    const x = document.createElement("button");
    x.className = "rcard-x";
    x.title = "Remove from Recent";
    x.setAttribute("aria-label", "Remove " + title + " from Recent");
    x.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>';
    x.addEventListener("click", () => forgetRecent(r, wrap));
    wrap.append(card, x);
    return wrap;
  }
  // Takes a document off Recent (Home and Open Recent). The file itself is never touched. Unless a tab has it open,
  // Edith also stops being able to read it until it is opened again (see forget-file in main.js).
  async function forgetRecent(r, wrap) {
    if (wrap.dataset.gone) return;
    wrap.dataset.gone = "1";
    const grid = $("startRecent");
    const cards = [...grid.children];
    const i = cards.indexOf(wrap);
    try {
      await idb("recent", "readwrite", (st) => st.delete(r.name));
    } catch (e) {}
    pushRecentToMenu();
    if (native && native.forgetFile && r.path && !tabs.some((t) => t.fileRef && t.fileRef.path === r.path)) native.forgetFile(r.path);
    const focusNext = wrap.contains(document.activeElement);
    // fade and shrink the card, then slide the others into its place
    const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    if (!reduceMotion())
      await wrap.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "scale(.92)" },
        ],
        { duration: 180, easing: "ease-in" },
      ).finished;
    wrap.remove();
    const shown = new Set([...grid.children].map((c) => c.dataset.key));
    const extra = (await listRecent()).slice(0, RECENT_CARDS).find((x) => !shown.has(x.name));
    if (extra) grid.appendChild(await recentCard(extra));
    if (!reduceMotion())
      [...grid.children].forEach((c) => {
        const a = before.get(c);
        if (!a) return c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
        const z = c.getBoundingClientRect();
        if (a.left !== z.left || a.top !== z.top)
          c.animate([{ transform: "translate(" + (a.left - z.left) + "px," + (a.top - z.top) + "px)" }, { transform: "none" }], {
            duration: 180,
            easing: "ease-out",
          });
      });
    $("startRecentHead").hidden = !grid.children.length;
    if (focusNext) {
      const next = grid.children[Math.min(i, grid.children.length - 1)];
      (next ? next.querySelector(".rcard") : $("startNew")).focus();
    }
  }
  let homeShown = false;
  async function showStart() {
    homeShown = true;
    $("start").hidden = false;
    document.body.classList.add("home");
    syncScratchUI();
    stMsg.textContent = "";
    $("btnHome").classList.add("active");
    hideBubble();
    closeMenus();
    closeFind(false);
    if (T) {
      renderTabs();
      saveSession();
    }
    if (!T) {
      fnameEl.value = "";
      $("dirty").classList.remove("on");
      document.title = native ? "Edith" : "Edith";
      $("tabsScroll").innerHTML = "";
      $("panel-outline").innerHTML = "";
      $("panel-notes").innerHTML = "";
      $("panel-history").innerHTML = "";
      $("nOutline").textContent = $("nNotes").textContent = $("nHistory").textContent = "";
      $("stWords").textContent = "";
      $("stChars").textContent = "";
      $("stRead").textContent = "";
    }
    const rs = await listRecent();
    const b = $("startRecent");
    b.innerHTML = "";
    $("startRecentHead").hidden = !rs.length;
    for (const r of rs.slice(0, RECENT_CARDS)) b.appendChild(await recentCard(r));
    saveSession();
  }
  function hideStart() {
    homeShown = false;
    $("start").hidden = true;
    document.body.classList.remove("home");
    $("btnHome").classList.remove("active");
  }
  async function activateTab(tab) {
    if (T === tab) {
      if (homeShown) {
        hideStart();
        renderTabs();
        tab.editor.focus();
      }
      return;
    }
    hideStart();
    if (T) {
      await flushTab(T);
      T.anchor = captureAnchor();
      T.el.hidden = true;
    }
    T = tab;
    tab.el.hidden = false;
    if (tab.anchor) settleAnchor(tab.anchor);
    fnameEl.value = tab.name;
    setDirty(tab.dirty);
    applyModeUI();
    applySpell();
    hideBubble();
    syncScratchUI();
    tab.cachedMd = tab.editor.getMarkdown();
    refreshDecorations();
    renderNotes();
    buildOutline(tab.cachedMd);
    updateStats(tab.cachedMd);
    renderHistory();
    renderTabs();
    if (tab.pendingChange) {
      tab.pendingChange = false;
      onChange();
    }
    if (tab.pendingAutosave) {
      tab.pendingAutosave = false;
      if (tab.dirty && prefs.autosave && tab.fileRef) saveFile(false, true);
    }
    if (tab.pendingVersion) {
      tab.pendingVersion = false;
      snapshot("Auto");
    }
    setTimeout(() => {
      ensureMdGutter();
      tab.editor.focus();
    }, 0);
    saveSession();
  }
  const isPristine = (tab) => !tab.dirty && !tab.fileRef && !tab.notes.length && (!tab.editor.getMarkdown().trim() || tab.isWelcome);
  async function newTab(activate) {
    const tab = createTab();
    tab.editor.setMarkdown("", false);
    tab.lastSavedText = serializeTab(tab);
    if (activate !== false) await activateTab(tab);
    else renderTabs();
    return tab;
  }
  async function closeTab(tab) {
    if (tab.dirty && !isScratch(tab)) {
      await flushTab(tab);
      if (tab.dirty) {
        const prevT = T;
        if (T !== tab) await activateTab(tab);
        let choice; // 0 save, 1 cancel, 2 discard
        if (native) choice = await native.askClose(tab.name);
        else
          choice = (await confirmBox("Unsaved changes", "Save changes to " + tab.name + " before closing?", "Save"))
            ? 0
            : (await confirmBox("Discard changes?", "Your latest changes to " + tab.name + " will be lost.", "Discard"))
              ? 2
              : 1;
        if (choice === 1) {
          if (prevT && prevT !== tab) await activateTab(prevT);
          return false;
        }
        if (choice === 0) {
          await saveFile(false);
          if (tab.dirty) return false;
        }
      }
    }
    // a closed tab's pending change, draft and version timers would otherwise run against the next tab, or none
    Object.keys(tab.timers).forEach((k) => {
      clearTimeout(tab.timers[k]);
      tab.timers[k] = null;
    });
    const i = tabs.indexOf(tab);
    tabs.splice(i, 1);
    try {
      tab.editor.destroy();
    } catch (e) {}
    tab.el.remove();
    if (!tabs.length) {
      T = null;
      showStart();
    } else if (T === tab) {
      T = null;
      await activateTab(tabs[Math.min(i, tabs.length - 1)]);
    } else renderTabs();
    saveSession();
    return true;
  }
  const cycleTab = (dir) => {
    if (tabs.length < 2) return;
    activateTab(tabs[(tabs.indexOf(T) + dir + tabs.length) % tabs.length]);
  };
  $("tabAdd").addEventListener("click", () => newTab());
  const toggleHome = () => {
    if (homeShown) {
      if (T) activateTab(T);
    } else showStart();
  };
  $("btnHome").addEventListener("click", toggleHome);
  $("startNew").addEventListener("click", () => newTab());
  $("startOpen").addEventListener("click", () => openFile());

  // Scratch mode: paste in, edit, copy Markdown out. Nothing to save, nothing asks to be saved.
  const isScratch = (tab) => !!(tab && tab.scratch && !tab.fileRef);
  function syncScratchUI() {
    $("btnCopyScratch").hidden = !(T && !homeShown && isScratch(T));
  }
  async function scratchFromClipboard() {
    let text = "";
    try {
      text = native ? await native.readClipboard() : await navigator.clipboard.readText();
    } catch (e) {}
    const tab = await newTab();
    tab.scratch = true;
    if (text.trim()) {
      loadIntoTab(tab, text, "scratch.md");
      tab.lastSavedText = serializeTab(tab);
      setDirty(false);
      message("Pasted from the clipboard. Edit, then Copy Markdown");
    } else {
      tab.name = "scratch.md";
      fnameEl.value = tab.name;
      renderTabs();
      message("Clipboard was empty. Paste with ⌘V, edit, then Copy Markdown");
    }
    syncScratchUI();
    tab.editor.focus();
    saveSession();
  }
  $("btnCopyScratch").addEventListener("click", () => ACT.copymd());
  $("startScratch").addEventListener("click", () => scratchFromClipboard());

  // Session: open tabs + unsaved text, restored on launch
  let sessionTimer = null;
  function saveSession() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
      if (!tabs.length) {
        store(SESSION_KEY, { active: 0, tabs: [] });
        return;
      }
      const list = tabs.map((tab) => ({
        name: tab.name,
        path: (tab.fileRef && tab.fileRef.path) || null,
        scratch: !!tab.scratch,
        notes: tab.notes,
        trash: tab.trash || [],
        dirty: tab.dirty,
        text: tab.dirty || !tab.fileRef ? serializeFrom(tab.cachedMd || tab.editor.getMarkdown(), tab.notes) : null,
        mode: tab.editor.isMarkdownMode() ? "markdown" : "wysiwyg",
        at: Date.now(),
      }));
      store(SESSION_KEY, { active: tabs.indexOf(T), tabs: list, home: homeShown });
    }, 400);
  }

  // ---- Pictures as shown (display only: the Markdown keeps its own paths, so saving never changes them)
  // A relative path is resolved against the document's folder, not the app page. Pictures from the web are never
  // loaded (the page's CSP blocks them, so Edith contacts no other site) and show their alt text in a quiet placeholder.
  const WEB_IMG = /^(https?:)?\/\//i;
  const imgBase = (tab) => {
    const p = tab && tab.fileRef && tab.fileRef.path;
    return p
      ? "file://" +
          p
            .replace(/[^/]*$/, "")
            .split("/")
            .map(encodeURIComponent)
            .join("/")
      : "";
  };
  function webImagePlaceholder(alt) {
    const text = (alt || "Image from the web").slice(0, 80);
    const font = "13px -apple-system, Helvetica, Arial, sans-serif";
    const ctx = (webImagePlaceholder.ctx = webImagePlaceholder.ctx || document.createElement("canvas").getContext("2d"));
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 26;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      w +
      '" height="28"><rect x=".5" y=".5" width="' +
      (w - 1) +
      '" height="27" rx="5" fill="none" stroke="#9c9484" stroke-opacity=".6" stroke-dasharray="3 3"/><text x="13" y="18.5" style="font:' +
      font +
      '" fill="#8c8473">' +
      escapeHtml(text) +
      "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  // the src to show for a picture's own src, or null to leave it alone
  function shownImageSrc(src, alt, base) {
    if (WEB_IMG.test(src)) return webImagePlaceholder(alt);
    if (!base || !src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.charAt(0) === "/" || src.charAt(0) === "#") return null;
    try {
      return new URL(src, base).href;
    } catch (e) {
      return null;
    }
  }
  // Rewrites only the rendered <img> elements (ProseMirror ignores attribute changes on leaf nodes); the original src is kept in data-src.
  function showImages(tab) {
    const base = imgBase(tab);
    tab.el.querySelectorAll("img[src]").forEach((img) => {
      let src = img.getAttribute("src");
      if (img.dataset.shown === src) {
        if (img.dataset.base === base) return;
        src = img.dataset.src;
      }
      const out = shownImageSrc(src, img.getAttribute("alt"), base);
      if (!out) return;
      img.classList.toggle("img-web", WEB_IMG.test(src));
      Object.assign(img.dataset, { src, base, shown: out });
      img.setAttribute("src", out);
    });
  }

  // The document's HTML with each picture's own src: in Write mode Toast UI reads the rendered page, where showImages changed it.
  function docHtml() {
    const d = new DOMParser().parseFromString(T.editor.getHTML(), "text/html");
    d.querySelectorAll("img[data-shown]").forEach((img) => {
      img.setAttribute("src", img.dataset.src);
      ["data-src", "data-base", "data-shown"].forEach((a) => img.removeAttribute(a));
      img.classList.remove("img-web");
      if (!img.classList.length) img.removeAttribute("class");
    });
    return d.body.innerHTML;
  }

  async function saveImage(tab, blob, cb) {
    const toDataUrl = () => {
      const r = new FileReader();
      r.onload = () => cb(r.result, blob.name || "image");
      r.readAsDataURL(blob);
    };
    if (!native || !tab.fileRef || !tab.fileRef.path) {
      toDataUrl();
      if (native) message("Image embedded in the document. Save the file first and pasted images are stored next to it instead.");
      return;
    }
    try {
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const dir = tab.fileRef.path.replace(/\.[^/]+$/, "") + "-images";
      const name = "image-" + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "") + "." + ext;
      const r = await native.writeBinary(dir + "/" + name, new Uint8Array(await blob.arrayBuffer()));
      if (!r.ok) throw new Error(r.error);
      cb(encodeURI(baseName(dir) + "/" + name), blob.name || "image");
      message("Image saved to " + baseName(dir) + "/" + name);
    } catch (e) {
      toDataUrl();
      message("Could not save the image next to the file (" + e.message + "); embedded it instead.", "err");
    }
  }

  // =====================================================================
  // Document text and notes (notes ride along in a trailing hidden comment)
  // =====================================================================
  const NOTE_RE = /\n*<!--\s*mdnotes\s+(\{[\s\S]*?\})\s*-->\s*$/;
  function normalizeMd(md) {
    const lines = md.split("\n");
    let fence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) {
        fence = !fence;
        continue;
      }
      if (!fence)
        lines[i] = lines[i]
          .replace(/^(\s*)\* /, "$1- ")
          .replace(/^\s*(\*\s*){3,}$/, "---")
          .replace(/[ \t]+$/, (m) => (m.length >= 2 ? "  " : ""));
    }
    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  }
  // A document file is only ever the text. Notes are kept by Edith (see "Notes store" below); the old trailing comment is read once, to migrate.
  function serializeFrom(md) {
    return normalizeMd(md).replace(/\s+$/, "") + "\n";
  }
  const withNotesText = (md, notes) => serializeFrom(md) + (notes.length ? "\n<!-- mdnotes " + JSON.stringify({ v: 1, notes }) + " -->\n" : "");
  const serializeTab = (tab) => serializeFrom(tab.editor.getMarkdown(), tab.notes);
  const serialize = () => serializeTab(T);
  const getDoc = () => normalizeMd(T.editor.getMarkdown());
  function splitNotes(text) {
    const m = text.match(NOTE_RE);
    if (!m) return { text, notes: [] };
    try {
      const data = JSON.parse(m[1]);
      return { text: text.replace(NOTE_RE, "\n"), notes: Array.isArray(data.notes) ? data.notes : [] };
    } catch (e) {
      return { text, notes: [] };
    }
  }

  // =====================================================================
  // Change tracking, autosave, drafts
  // =====================================================================
  function setDirty(v) {
    if (!T) return;
    T.dirty = v;
    $("dirty").classList.toggle("on", v);
    document.title = (v ? "● " : "") + T.name + (native ? "" : " — Edith");
    const tabEl = $("tabsScroll").querySelector('.tab[data-id="' + T.id + '"]');
    if (tabEl) tabEl.classList.toggle("dirty", v);
    if (native) native.setDocState({ path: (T.fileRef && T.fileRef.path) || null, dirty: v });
  }
  function commitChange() {
    T.cachedMd = T.editor.getMarkdown();
    if (T.isWelcome && serializeFrom(T.cachedMd, T.notes) !== T.lastSavedText) T.isWelcome = false;
    const text = serializeFrom(T.cachedMd, T.notes);
    setDirty(text !== T.lastSavedText);
    updateStats(T.cachedMd);
    buildOutline(T.cachedMd);
    if (T.notes.length) {
      layoutMargin();
      if (
        !document.querySelector(".modal.on") &&
        sortedOpen(
          T,
          T.notes.filter((n) => !n.done),
        )
          .map((n) => n.id)
          .join() !== T.noteSig
      )
        renderNotes();
    }
    persistNotes(T);
    const tm = T.timers;
    clearTimeout(tm.draft);
    tm.draft = setTimeout(() => {
      tm.draft = null;
      saveSession();
    }, 800);
    if (T.dirty && prefs.autosave && T.fileRef) {
      clearTimeout(tm.autosave);
      const tab = T;
      tm.autosave = setTimeout(() => {
        tm.autosave = null;
        if (T === tab) saveFile(false, true);
        else tab.pendingAutosave = true;
      }, prefs.autosaveDelay * 1000);
    }
    if (!tm.version) {
      const tab = T;
      tm.version = setTimeout(
        async () => {
          tm.version = null;
          if (T !== tab) {
            tab.pendingVersion = true;
            return;
          }
          if (await snapshot("Auto")) message("Version saved automatically");
        },
        prefs.verMinutes * 60 * 1000,
      );
    }
  }
  function onChange() {
    if (!T) return;
    const tm = T.timers;
    clearTimeout(tm.change);
    const n = T.cachedMd.length;
    const wait = n > 400000 ? 1800 : n > 150000 ? 1100 : n > 60000 ? 700 : 450;
    tm.change = setTimeout(() => {
      tm.change = null;
      commitChange();
    }, wait);
  }
  function setAutosave(on) {
    prefs.autosave = on;
    savePrefs();
    $("btnAutosave").textContent = "Autosave: " + (on ? "on" : "off");
    $("btnAutosave").classList.toggle("on", on);
    updateAutosaveTip();
  }
  function updateAutosaveTip() {
    const p = T && T.fileRef && T.fileRef.path;
    $("btnAutosave").title = prefs.autosave
      ? p
        ? "Writes into " + p + " " + prefs.autosaveDelay + "s after you stop typing. There is no separate autosave file. Click to turn off."
        : "This document hasn’t been saved yet, so there is nothing to autosave into. Save it once (⌘S) and autosave takes over. Click to turn off."
      : "Click to write changes to the open file automatically.";
  }
  $("btnAutosave").addEventListener("click", () => setAutosave(!prefs.autosave));

  // =====================================================================
  // Stats, zoom
  // =====================================================================
  function updateStats(md) {
    const text = md !== undefined ? md : T.editor.getMarkdown();
    const words = (text.match(/\S+/g) || []).length;
    setText($("stWords"), words.toLocaleString() + (words === 1 ? " word" : " words"));
    setText($("stChars"), text.length.toLocaleString() + " characters");
    const mins = Math.round(words / 230);
    setText($("stRead"), mins < 1 ? "<1 min read" : mins + " min read");
  }
  function setSize(px) {
    prefs.size = Math.max(10, Math.min(32, px));
    savePrefs();
    keepPosition(() => document.documentElement.style.setProperty("--doc-size", prefs.size + "px"));
    // a preset shows its own number (115% is 18px, which would otherwise read 113%)
    const presets = [...document.querySelectorAll("[data-zoom]")];
    presets.forEach((b) => b.classList.toggle("on", Math.round((BASE_SIZE * b.dataset.zoom) / 100) === prefs.size));
    const on = presets.find((b) => b.classList.contains("on"));
    const pct = (on ? on.dataset.zoom : Math.round((prefs.size / BASE_SIZE) * 100)) + "%";
    $("btnZoom").textContent = pct;
    $("zoomVal").textContent = pct;
    if ($("pSizeOut")) $("pSizeOut").textContent = pct;
  }
  bindMenu("btnZoom", "zoomMenu");
  $("zoomMenu").addEventListener("click", (e) => {
    const z = e.target.closest("[data-zoom]");
    const w = e.target.closest("[data-width]");
    if (z) {
      setSize(Math.round((BASE_SIZE * z.dataset.zoom) / 100));
      closeMenus();
    } else if (w) {
      setWidth(w.dataset.width);
      closeMenus();
    } else e.stopPropagation();
  });
  $("btnBigger").addEventListener("click", () => setSize(prefs.size + 1));
  $("btnSmaller").addEventListener("click", () => setSize(prefs.size - 1));
  function setWidth(w) {
    prefs.width = w;
    savePrefs();
    keepPosition(() => {
      work.classList.remove("w-wide", "w-full");
      if (w !== "normal") work.classList.add("w-" + w);
    });
    document.querySelectorAll("[data-width]").forEach((b) => b.classList.toggle("on", b.dataset.width === w));
  }
  function setFocus(on) {
    document.body.classList.toggle("focus", on);
    if (on) message("Focus mode — press ⇧⌘F or Esc to leave");
  }

  // =====================================================================
  // Outline
  // =====================================================================
  let headings = [];
  function parseHeadings(md) {
    const out = [];
    let fence = false;
    const lines = md.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      if (/^\s*(```|~~~)/.test(t)) {
        fence = !fence;
        continue;
      }
      if (fence) continue;
      const m = t.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ line: i, level: m[1].length, text: m[2].replace(/[*_`\\]/g, "") });
    }
    return out;
  }
  function buildOutline(md) {
    headings = parseHeadings(md !== undefined ? md : T.editor.getMarkdown());
    $("nOutline").textContent = headings.length || "";
    const p = $("panel-outline");
    if (!headings.length) {
      p.innerHTML =
        '<div class="panel-empty">Headings appear here as you add them. In Write mode, type <b>#</b> then a space at the start of a line for a title, <b>##</b> for a section.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    headings.forEach((h, i) => {
      const b = document.createElement("button");
      b.className = "ol-item l" + h.level;
      b.textContent = h.text;
      b.title = h.text;
      b.dataset.i = i;
      b.addEventListener("click", () => jumpToHeading(i));
      frag.appendChild(b);
    });
    p.innerHTML = "";
    p.appendChild(frag);
    markCurrentHeading();
  }
  function scrollParent(el) {
    let p = el && el.parentElement;
    while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement;
    return p || document.scrollingElement;
  }
  function revealElement(el, pad) {
    const sp = scrollParent(el);
    if (!sp || !el) return;
    const top = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop - (pad || 24);
    sp.scrollTo({ top, behavior: "auto" });
  }
  function selectDomRange(range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function jumpToHeading(i) {
    const h = headings[i];
    if (!h) return;
    if (isWW()) {
      const el = wwPM().querySelectorAll("h1,h2,h3,h4,h5,h6")[i];
      if (!el) return;
      const r = document.createRange();
      r.setStart(el, 0);
      r.collapse(true);
      selectDomRange(r);
      revealElement(el);
      wwPM().focus();
    } else {
      T.editor.setSelection([h.line + 1, 1], [h.line + 1, 1]);
      const el = mdPM().children[h.line];
      if (el) revealElement(el);
      T.editor.focus();
    }
    markCurrentHeading();
  }
  function currentHeadingIndex() {
    if (!headings.length || !T) return -1;
    if (isWW()) {
      const sel = window.getSelection();
      const pm = wwPM();
      if (!sel.rangeCount || !pm || !pm.contains(sel.anchorNode)) return -1;
      const hs = pm.querySelectorAll("h1,h2,h3,h4,h5,h6");
      let cur = -1;
      const node = sel.anchorNode;
      for (let i = 0; i < hs.length; i++) {
        if (hs[i].compareDocumentPosition(node) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) cur = i;
        else break;
      }
      return cur;
    }
    const s = T.editor.getSelection();
    const line = Array.isArray(s) && Array.isArray(s[0]) ? s[0][0] - 1 : 0;
    let cur = -1;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].line <= line) cur = i;
      else break;
    }
    return cur;
  }
  function markCurrentHeading() {
    const cur = currentHeadingIndex();
    const p = $("panel-outline");
    p.querySelectorAll(".ol-item").forEach((b) => b.classList.toggle("current", +b.dataset.i === cur));
    const el = p.querySelector(".current");
    if (el) {
      const r = el.getBoundingClientRect(),
        pr = p.getBoundingClientRect();
      if (r.top < pr.top || r.bottom > pr.bottom) el.scrollIntoView({ block: "nearest" });
    }
  }
  let caretTimer = null;
  document.addEventListener("selectionchange", () => {
    if (document.querySelector(".modal.on") || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) return;
    clearTimeout(caretTimer);
    caretTimer = setTimeout(() => {
      markCurrentHeading();
      const sel = T ? selectedText() : "";
      if (sel) {
        const w = (sel.match(/\S+/g) || []).length;
        setText($("stWords"), w.toLocaleString() + " of " + (T.cachedMd.match(/\S+/g) || []).length.toLocaleString() + " words selected");
      } else if (T) updateStats(T.cachedMd);
    }, 150);
  });

  // =====================================================================
  // Reading position — remember which block sits at the top of the view and put it back after the layout or the view changes
  // =====================================================================
  const normText = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const BLOCK_SEL = "h1,h2,h3,h4,h5,h6,p,pre,th,td";
  function viewRoot() {
    return !T ? null : isWW() ? wwPM() : mdPM();
  }
  const blockText = (el, ww) => normText(ww ? el.textContent : plainLine(el.textContent));
  function captureAnchor() {
    const root = viewRoot();
    if (!root || !root.offsetParent) return null;
    const ww = isWW(),
      rt = root.getBoundingClientRect().top;
    const els = ww ? root.querySelectorAll(BLOCK_SEL) : root.children;
    const seen = {};
    let hit = null;
    for (const el of els) {
      const t = blockText(el, ww);
      if (!t) continue;
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      if (r.bottom > rt + 2) {
        hit = { t, dup: seen[t] || 0, off: r.top - rt };
        break;
      }
      seen[t] = (seen[t] || 0) + 1;
    }
    return { hit, top: root.scrollTop, frac: root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight) };
  }
  function applyAnchor(a) {
    const root = viewRoot();
    if (!root || !a || !root.offsetParent) return;
    if (a.top < 4) {
      root.scrollTop = 0;
      return;
    }
    const ww = isWW();
    let el = null;
    if (a.hit) {
      const els = ww ? root.querySelectorAll(BLOCK_SEL) : root.children;
      let n = 0,
        loose = null;
      for (const e of els) {
        const t = blockText(e, ww);
        if (!t) continue;
        if (t === a.hit.t) {
          if (n++ === a.hit.dup) {
            el = e;
            break;
          }
        } else if (!loose && Math.min(t.length, a.hit.t.length) >= 6 && (t.endsWith(a.hit.t) || a.hit.t.endsWith(t))) loose = e;
      }
      el = el || loose;
    }
    if (el) root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - a.hit.off;
    else root.scrollTop = a.frac * Math.max(0, root.scrollHeight - root.clientHeight);
  }
  // The editor re-lays itself out and re-focuses over the next few hundred milliseconds, so re-apply until the reader scrolls or types.
  function settleAnchor(a) {
    if (!a) return;
    applyAnchor(a);
    let live = true;
    const evs = ["wheel", "keydown", "mousedown", "touchstart"];
    const stop = () => {
      live = false;
      evs.forEach((ev) => document.removeEventListener(ev, stop, true));
    };
    evs.forEach((ev) => document.addEventListener(ev, stop, true));
    [0, 60, 200, 450].forEach((ms) =>
      setTimeout(() => {
        if (live) applyAnchor(a);
      }, ms),
    );
    setTimeout(stop, 500);
  }
  function keepPosition(fn) {
    const a = captureAnchor();
    fn();
    settleAnchor(a);
  }

  // =====================================================================
  // Finding text in the document
  // =====================================================================
  function findInWW(needle, from) {
    const root = wwPM();
    if (!root || !needle) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    let full = "";
    const map = [];
    nodes.forEach((t, i) => {
      for (let k = 0; k < t.data.length; k++) map.push([i, k]);
      full += t.data;
    });
    const lower = full.toLowerCase(),
      q = needle.toLowerCase();
    const total = lower.split(q).length - 1;
    if (!total) return null;
    let idx = lower.indexOf(q, from || 0);
    if (idx < 0) idx = lower.indexOf(q, 0);
    const [n1, o1] = map[idx],
      [n2, o2] = map[idx + needle.length - 1];
    const r = document.createRange();
    r.setStart(nodes[n1], o1);
    r.setEnd(nodes[n2], o2 + 1);
    return {
      range: r,
      offset: idx,
      total,
      all: () => {
        const a = [];
        let i = -1;
        while ((i = lower.indexOf(q, i + 1)) >= 0) a.push(i);
        return a;
      },
    };
  }
  const mdPos = (text, off) => {
    const before = text.slice(0, off);
    return [before.split("\n").length, off - before.lastIndexOf("\n")];
  };
  function findInMD(needle, from) {
    const md = T.editor.getMarkdown();
    if (!needle) return null;
    const lower = md.toLowerCase(),
      q = needle.toLowerCase();
    const total = lower.split(q).length - 1;
    if (!total) return null;
    let idx = lower.indexOf(q, from || 0);
    if (idx < 0) idx = lower.indexOf(q, 0);
    return {
      start: mdPos(md, idx),
      end: mdPos(md, idx + needle.length),
      offset: idx,
      total,
      all: () => {
        const a = [];
        let i = -1;
        while ((i = lower.indexOf(q, i + 1)) >= 0) a.push(i);
        return a;
      },
    };
  }
  // The DOM selection alone is forgotten the moment the editor regains focus (it snaps back to the old caret), so mirror it into the editor state.
  function syncPmSelection(range) {
    try {
      const v = T.wwView;
      const a = v.posAtDOM(range.startContainer, range.startOffset),
        b = v.posAtDOM(range.endContainer, range.endOffset);
      v.dispatch(v.state.tr.setSelection(window.PM.TextSelection.create(v.state.doc, a, b)));
    } catch (e) {}
  }
  function selectMatch(needle, from) {
    if (isWW()) {
      const f = findInWW(needle, from);
      if (!f) return null;
      selectDomRange(f.range);
      syncPmSelection(f.range);
      revealElement(f.range.startContainer.parentElement, 120);
      return { next: f.offset + 1, total: f.total, offset: f.offset, all: f.all };
    }
    const f = findInMD(needle, from);
    if (!f) return null;
    T.editor.setSelection(f.start, f.end);
    const el = mdPM().children[f.start[0] - 1];
    if (el) revealElement(el, 120);
    return { next: f.offset + 1, total: f.total, offset: f.offset, all: f.all };
  }

  // =====================================================================
  // Notes — anchored highlights via ProseMirror decorations + sidebar cards
  // =====================================================================
  function selectedText() {
    if (!T) return "";
    if (isWW()) return String(window.getSelection()).trim();
    try {
      return (T.editor.getSelectedText() || "").trim();
    } catch (e) {
      return "";
    }
  }
  function selectionContext() {
    try {
      const sel = window.getSelection();
      if (!sel.rangeCount) return "";
      const r = sel.getRangeAt(0);
      const block = (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer).closest(
        "p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,div",
      );
      const pre = document.createRange();
      pre.selectNodeContents(block);
      pre.setEnd(r.startContainer, r.startOffset);
      return pre.toString().slice(-24);
    } catch (e) {
      return "";
    }
  }
  const decoCache = new WeakMap();
  // Anchoring: match on text with Markdown punctuation removed and all whitespace collapsed (a selection that crosses paragraphs comes
  // back from the browser with doubled newlines, while the document has one block boundary), so notes made in Markdown mode still land
  // in Write mode and long multi-paragraph notes highlight in full. Falls back to the quote's head/tail when the passage has been edited.
  const MARKUP = /[*_`~]/;
  const squash = (s) => s.replace(/\s+/g, " ");
  const normQuote = (q) =>
    squash(q.replace(/[*_`~]/g, ""))
      .trim()
      .toLowerCase();
  const normCtx = (q) => squash(q.replace(/[*_`~]/g, "")).toLowerCase();
  function findQuote(lower, q, ctx) {
    const cands = [];
    let i = -1;
    while ((i = lower.indexOf(q, i + 1)) >= 0 && cands.length < 50) cands.push(i);
    if (cands.length) {
      let best = cands[0];
      if (cands.length > 1 && ctx) {
        let bs = -1;
        cands.forEach((ci) => {
          const pre = lower.slice(Math.max(0, ci - ctx.length), ci);
          let k = 0;
          while (k < pre.length && k < ctx.length && pre[pre.length - 1 - k] === ctx[ctx.length - 1 - k]) k++;
          if (k > bs) {
            bs = k;
            best = ci;
          }
        });
      }
      return [best, best + q.length];
    }
    if (q.length < 16) return null;
    const n = Math.min(30, Math.floor(q.length / 2));
    const head = q.slice(0, n),
      tail = q.slice(-n);
    const hi = lower.indexOf(head),
      ti = hi >= 0 ? lower.indexOf(tail, hi + n) : -1;
    if (hi >= 0 && ti >= 0 && ti + n - hi <= q.length * 2 + 60) return [hi, ti + n];
    if (hi >= 0) return [hi, hi + n];
    const t2 = lower.indexOf(tail);
    return t2 >= 0 ? [t2, t2 + n] : null;
  }
  // Where every open note lands in a document: [{ n, from, to }] in ProseMirror positions, plus the decorations that paint them.
  function noteLayout(tab, doc) {
    const c = decoCache.get(doc);
    if (c && c.rev === tab.notesRev) return c;
    let text = "";
    const pos = [];
    doc.descendants((node, p) => {
      if (node.isText) {
        for (let i = 0; i < node.text.length; i++) {
          const ch = node.text[i];
          if (MARKUP.test(ch)) continue;
          if (/\s/.test(ch)) {
            if (!text.length || text.endsWith(" ")) continue;
            text += " ";
            pos.push(p + i);
          } else {
            text += ch;
            pos.push(p + i);
          }
        }
      } else if ((node.isBlock || (node.isInline && node.isLeaf && !/image/i.test(node.type.name))) && text.length && !text.endsWith(" ")) {
        text += " ";
        pos.push(-1);
      }
      return true;
    });
    const lower = text.toLowerCase();
    const ranges = [];
    tab.notes.forEach((n) => {
      if (n.done || !n.quote) return;
      const r = findQuote(lower, normQuote(n.quote), normCtx(n.ctx || ""));
      if (!r) return;
      let a = r[0],
        z = r[1] - 1;
      while (a <= z && pos[a] < 0) a++;
      while (z >= a && pos[z] < 0) z--;
      if (a > z) return;
      ranges.push({ n, from: pos[a], to: pos[z] + 1 });
    });
    // Each note gets its own element (nodeName) so overlapping notes nest instead of merging into one; larger passages go first so a
    // note inside another note ends up as the inner element and stays clickable.
    const decos = ranges
      .slice()
      .sort((x, y) => y.to - y.from - (x.to - x.from))
      .map(({ n, from, to }) =>
        window.PM.Decoration.inline(from, to, {
          nodeName: "span",
          class: "note-mark" + (tab.pulseNote === n.id ? " pulse" : ""),
          "data-note": n.id,
          title: n.text.slice(0, 120),
        }),
      );
    const out = { rev: tab.notesRev, ranges, set: window.PM.DecorationSet.create(doc, decos) };
    decoCache.set(doc, out);
    return out;
  }
  function noteDecorations(tab, doc) {
    if (!tab.notes.some((n) => !n.done && n.quote)) return window.PM.DecorationSet.empty;
    return noteLayout(tab, doc).set;
  }
  function refreshDecorations() {
    T.notesRev++;
    [T.wwView, T.mdView].forEach((v) => {
      try {
        v.dispatch(v.state.tr.setMeta("notes", T.notesRev));
      } catch (e) {}
    });
    layoutMargin();
  }
  function pulseMark(id) {
    const tab = T;
    tab.pulseNote = id;
    refreshDecorations();
    clearTimeout(tab.pulseTimer);
    tab.pulseTimer = setTimeout(() => {
      tab.pulseNote = null;
      if (T === tab) refreshDecorations();
    }, 1800);
  }

  // Note types are optional. Most notes need no type: the prompt tells the AI to judge each one (a question gets an answer, an instruction gets an edit). A type is only recorded when the writer picks one.
  const KINDS = { change: "Change", ask: "Ask", keep: "Keep" };
  const KIND_HINT = {
    change: "An edit you want made to this passage.",
    ask: "A question. You want an answer first, with nothing changed until you approve.",
    keep: "This passage works. It should be left exactly as it is.",
  };
  function guessKind(text) {
    const t = (text || "").trim();
    if (!t) return "change";
    if (/\?\s*$/.test(t)) return "ask";
    return /\?/.test(t) &&
      /^(why|how|what|when|where|who|which|is|are|was|were|do|does|did|can|could|should|would|will|might|isn'?t|aren'?t|shouldn'?t|wouldn'?t|doesn'?t|am i)\b/i.test(
        t,
      )
      ? "ask"
      : "change";
  }
  const kindOf = (n) => (n.kind && KINDS[n.kind] ? n.kind : guessKind(n.text));
  let noteEditing = null,
    noteKind = "change",
    noteKindManual = false;
  const showKindRow = (on) => {
    $("kindRow").hidden = !on;
    $("kindMore").hidden = on;
  };
  function setNoteKind(k, manual) {
    if (manual) noteKindManual = true;
    if (k === noteKind && $("kindHint").textContent) return;
    noteKind = k;
    document.querySelectorAll("#noteKind [data-kind]").forEach((b) => b.classList.toggle("active", b.dataset.kind === k));
    setText($("kindHint"), KIND_HINT[k]);
  }
  $("kindMore").addEventListener("click", () => {
    showKindRow(true);
    noteKindManual = true;
    setNoteKind(noteKind);
  });
  document.querySelectorAll("#noteKind [data-kind]").forEach((b) =>
    b.addEventListener("click", () => {
      setNoteKind(b.dataset.kind, true);
      $("noteText").focus();
    }),
  );
  $("noteText").addEventListener("input", () => {
    if (!noteKindManual) {
      const g = guessKind($("noteText").value);
      if (g !== noteKind) setNoteKind(g);
    }
  });
  const clipQuote = (q) => (q.length > 300 ? q.slice(0, 300) + "…" : q);
  function addNote() {
    if (!T || homeShown) return;
    const q = selectedText();
    noteEditing = null;
    hideBubble();
    $("noteTitle").textContent = "Add a note";
    $("noteQuote").textContent = q ? "“" + clipQuote(q) + "”" : "No text selected — this will be a general note on the document.";
    $("noteQuote").dataset.q = q.slice(0, 8000);
    $("noteQuote").dataset.ctx = q ? selectionContext() : "";
    $("noteText").value = "";
    noteKindManual = false;
    noteKind = "";
    setNoteKind("change");
    showKindRow(false);
    openModal("mNote");
  }
  function editNote(n) {
    noteEditing = n;
    $("noteTitle").textContent = "Edit note";
    $("noteQuote").textContent = n.quote ? "“" + clipQuote(n.quote) + "”" : "General note";
    $("noteQuote").dataset.q = n.quote || "";
    $("noteQuote").dataset.ctx = n.ctx || "";
    $("noteText").value = n.text;
    noteKind = "";
    noteKindManual = !!n.kind;
    setNoteKind(kindOf(n));
    showKindRow(!!n.kind);
    openModal("mNote");
  }
  $("noteSave").addEventListener("click", () => {
    const text = $("noteText").value.trim();
    if (!text) {
      $("noteText").focus();
      return;
    }
    let id;
    if (noteEditing) {
      noteEditing.text = text;
      if (noteKindManual) noteEditing.kind = noteKind;
      noteEditing.updated = Date.now();
      id = noteEditing.id;
    } else {
      id = uid();
      const nn = {
        id,
        quote: $("noteQuote").dataset.q || "",
        ctx: $("noteQuote").dataset.ctx || "",
        text,
        kind: noteKindManual ? noteKind : undefined,
        created: Date.now(),
        done: false,
      };
      logNoteOp(T, "add", nn);
      T.notes.push(nn);
      T.freshNote = id;
    }
    hideModal($("mNote"));
    refreshDecorations();
    renderNotes();
    onChange();
    if (!marginActive()) setTab("notes");
    if (T.notes.find((n) => n.id === id && n.quote)) pulseMark(id);
  });
  $("noteText").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") $("noteSave").click();
  });

  // =====================================================================
  // Notes store — notes live in Edith's own data (IndexedDB 'notes', mirrored as plain JSON files in <data folder>/notes-backup), never in the .md file.
  // Keyed by the file's path; if a file is moved or renamed, its notes are found again by the opening of its text.
  // =====================================================================
  const fingerprint = (tab) => normText(tab.editor.getMarkdown().slice(0, 600)).slice(0, 160);
  const keyHash = (k) => {
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
    return (
      (h >>> 0).toString(36) +
      "-" +
      baseName(k)
        .replace(/[^\w.-]/g, "_")
        .slice(0, 40)
    );
  };
  async function findNotes(tab) {
    try {
      let rec = await idb("notes", "readonly", (s) => s.get(keyOf(tab)));
      if (!rec && native) {
        const fp = fingerprint(tab);
        if (fp.length >= 40) {
          const m = ((await idb("notes", "readonly", (s) => s.getAll())) || []).filter((r) => r.fp === fp && r.key !== keyOf(tab) && r.notes && r.notes.length);
          if (m.length === 1 && m[0].key.charAt(0) === "/") {
            const st = await native.stat(m[0].key);
            if (!st.ok && !st.denied) rec = m[0];
          }
        }
      }
      return rec || null;
    } catch (e) {
      return null;
    }
  }
  async function persistNotes(tab, force) {
    if (!tab || !tab.fileRef) return true;
    const json = JSON.stringify([tab.notes, tab.trash || []]);
    if (!force && json === tab.notesSaved) return true;
    const rec = { key: keyOf(tab), notes: tab.notes, trash: tab.trash || [], fp: fingerprint(tab), at: Date.now() };
    try {
      await idb("notes", "readwrite", (s) => s.put(rec));
      tab.notesSaved = json;
      if (native && native.writeBinary)
        native
          .writeBinary(native.paths().userData + "/notes-backup/" + keyHash(rec.key) + ".json", new TextEncoder().encode(JSON.stringify(rec)))
          .catch(() => {});
      return true;
    } catch (e) {
      message("Could not store notes: " + e.message, "err");
      return false;
    }
  }
  // On opening a file: take its notes from the store, plus any left in the old trailing comment (those are moved into the store and the file is cleaned on its next save).
  async function adoptNotes(tab, quiet) {
    if (!tab.fileRef) return;
    const legacy = tab.notes.slice();
    const rec = await findNotes(tab);
    const cutoff = Date.now() - 90 * 864e5;
    let notes = legacy;
    if (rec && Array.isArray(rec.notes)) {
      const have = new Set(rec.notes.map((n) => n.id));
      notes = rec.notes.concat(legacy.filter((n) => !have.has(n.id)));
    }
    tab.notes = notes;
    tab.trash = ((rec && rec.trash) || []).filter((t) => t.at > cutoff);
    if (tab === T) {
      refreshDecorations();
      renderNotes();
    }
    const ok = await persistNotes(tab, true);
    if (legacy.length && ok) {
      tab.lastSavedText = "";
      if (tab === T) setDirty(true);
      else tab.dirty = true;
      if (!quiet) message("Notes moved out of the file into Edith. Your next save leaves the file clean.");
    }
  }
  function trashNote(tab, n) {
    tab.trash = [{ note: n, at: Date.now() }].concat(tab.trash || []).slice(0, 200);
  }
  function restoreNote(entry) {
    T.trash = (T.trash || []).filter((t) => t !== entry);
    T.notes.push(entry.note);
    refreshDecorations();
    renderNotes();
    onChange();
  }
  function renderTrash(p) {
    const tr = T.trash || [];
    if (!tr.length) return;
    const d = document.createElement("details");
    d.className = "trash";
    d.innerHTML = "<summary>Recently deleted (" + tr.length + ")</summary>";
    tr.forEach((e) => {
      const r = document.createElement("div");
      r.className = "trash-row";
      const t = document.createElement("div");
      t.className = "tt";
      t.textContent = (e.note.quote ? "“" + e.note.quote.replace(/\s+/g, " ").slice(0, 60) + "” " : "") + e.note.text;
      t.title = e.note.text;
      const b = document.createElement("button");
      b.textContent = "Restore";
      b.addEventListener("click", () => restoreNote(e));
      r.append(t, b);
      d.appendChild(r);
    });
    d.open = !!T.trashOpen;
    d.addEventListener("toggle", () => {
      T.trashOpen = d.open;
    });
    p.appendChild(d);
  }
  const sortedOpen = (tab, open) =>
    prefs.noteSort === "recent" ? open.slice().sort((a, b) => (b.updated || b.created) - (a.updated || a.created)) : pageOrder(tab, open);

  // Notes in page order: general notes first, then top to bottom. Notes whose passage can no longer be found go last.
  function pageOrder(tab, notes) {
    const v = tab.editor.isWysiwygMode() ? tab.wwView : tab.mdView;
    const at = new Map(noteLayout(tab, v.state.doc).ranges.map((r) => [r.n.id, r.from]));
    const pos = (n) => (at.has(n.id) ? at.get(n.id) : Infinity);
    return notes.slice().sort((a, b) => (a.quote ? 1 : 0) - (b.quote ? 1 : 0) || pos(a) - pos(b) || a.created - b.created);
  }

  // Notes as a prompt: every open note compiled into one message for any AI assistant, in page order
  const plainLine = (l) =>
    l
      .replace(/^\s*(?:[#>]+|[-*+]|\d+[.)])\s+/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  function sectionFor(md, quote) {
    const needle = plainLine(quote.split("\n")[0]).slice(0, 40);
    if (!needle) return "";
    let heading = "";
    for (const line of splitNotes(md).text.split("\n")) {
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) heading = plainLine(h[1]);
      if (plainLine(line).includes(needle)) return heading;
    }
    return "";
  }
  const clipForPrompt = (q) => {
    q = q.replace(/\s+/g, " ").trim();
    return q.length > 700 ? q.slice(0, 450) + " […] " + q.slice(-200) : q;
  };
  function buildRevisionPrompt(tab) {
    const open = tab.notes.filter((n) => !n.done);
    if (!open.length) return "";
    const md = tab.editor.getMarkdown();
    const title = isScratch(tab) ? "the document" : '"' + tab.name.replace(/\.[^.]+$/, "") + '"';
    const list = pageOrder(tab, open);
    const out = [
      "I have left " +
        (open.length === 1 ? "a note" : open.length + " notes") +
        " on " +
        title +
        ". Each one quotes the passage it points to, in the order they appear.",
      "",
      "Use your judgement on each note rather than treating them all as edit orders:",
      "- If it is a question, or asks for your opinion, answer it and explain your reasoning. Do not change that passage until I have read your answer and approved.",
      "- If it is a clear instruction, make the edit.",
      "- If I say a passage works, or to keep it, leave it exactly as it is.",
      "- If a note is ambiguous, or you disagree with it, tell me and say what you would do instead of guessing.",
      "",
      "Leave everything I have not commented on as it is. Number your replies to match mine.",
      "",
      "---",
      "",
    ];
    list.forEach((n, i) => {
      const tag = i + 1 + ". ";
      if (n.quote) {
        const sec = sectionFor(md, n.quote);
        out.push(tag + (sec ? 'Under "' + sec + '": ' : "") + '"' + clipForPrompt(n.quote) + '"');
      } else out.push(tag + "(About the document as a whole)");
      const k = n.kind && KINDS[n.kind] ? { ask: "[Question] ", keep: "[Keep as is] ", change: "[Edit] " }[n.kind] : "";
      out.push("   " + k + n.text.trim().replace(/\n/g, "\n   "), "");
    });
    return out.join("\n");
  }
  function copyRevisionPrompt() {
    if (!T || homeShown) return;
    const text = buildRevisionPrompt(T);
    const n = T.notes.filter((x) => !x.done).length;
    if (!text) {
      message("No open notes to compile. Select text and add a note first.", "err");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => message("Copied " + n + (n === 1 ? " note" : " notes") + " as a prompt — paste it into your AI chat"),
      () => message("Could not copy to the clipboard", "err"),
    );
  }
  function noteAction(n, a) {
    const tab = T;
    if (a === "edit") {
      editNote(n);
      return;
    }
    logNoteOp(tab, a, n);
    if (a === "done") n.done = !n.done;
    else if (a === "del") {
      tab.notes = tab.notes.filter((x) => x !== n);
      trashNote(tab, n);
    }
    refreshDecorations();
    renderNotes();
    onChange();
  }
  // Undo reaches note actions (delete, resolve) as well as text, in the order they happened, like Google Docs.
  // Each action remembers how deep the text undo history was; once undo has unwound back to that depth, the next undo reverses the note action.
  // Write and Markdown mode keep separate text histories: for an action taken in the other mode, everything typed since the last
  // mode switch (tab.modeBase, the depth right after it) is newer and is undone first.
  const histView = (tab) => (tab.editor.isWysiwygMode() ? tab.wwView : tab.mdView);
  const histDepth = (tab, fn) => {
    try {
      return window.PM[fn](histView(tab).state);
    } catch (e) {
      return 0;
    }
  };
  function logNoteOp(tab, a, n) {
    (tab.noteUndo = tab.noteUndo || []).push({ a, n, depth: histDepth(tab, "undoDepth"), ww: tab.editor.isWysiwygMode() });
    tab.noteRedo = [];
  }
  function flipNote(tab, op) {
    if (op.a === "add") {
      tab.notes = tab.notes.includes(op.n) ? tab.notes.filter((x) => x !== op.n) : tab.notes.concat(op.n);
    } else if (op.a === "del") {
      if (tab.notes.includes(op.n)) {
        tab.notes = tab.notes.filter((x) => x !== op.n);
        trashNote(tab, op.n);
      } else {
        tab.trash = (tab.trash || []).filter((t) => t.note !== op.n);
        tab.notes.push(op.n);
      }
    } else op.n.done = !op.n.done;
    refreshDecorations();
    renderNotes();
    onChange();
  }
  function undoNoteOp(redo) {
    const tab = T;
    if (!tab || homeShown) return false;
    const st = redo ? tab.noteRedo : tab.noteUndo;
    const op = st && st[st.length - 1];
    if (!op) return false;
    const ww = tab.editor.isWysiwygMode();
    if (
      redo
        ? op.uw === ww && (histDepth(tab, "redoDepth") !== op.rAt || histDepth(tab, "undoDepth") !== op.uAt)
        : histDepth(tab, "undoDepth") > (op.ww === ww ? op.depth : tab.modeBase || 0)
    )
      return false;
    st.pop();
    if (op.a !== "add" && !tab.notes.includes(op.n) && !(tab.trash || []).some((t) => t.note === op.n)) return undoNoteOp(redo);
    if (!redo) {
      op.uAt = histDepth(tab, "undoDepth");
      op.rAt = histDepth(tab, "redoDepth");
      op.uw = ww;
    }
    flipNote(tab, op);
    (redo ? tab.noteUndo : tab.noteRedo).push(op);
    message(
      redo
        ? op.a === "del"
          ? "Deleted the note again"
          : op.a === "add"
            ? "Note added again"
            : "Redone"
        : op.a === "add"
          ? "Note removed"
          : op.a === "del"
            ? "Restored the deleted note"
            : op.n.done
              ? "Note resolved again"
              : "Reopened the note",
    );
    return true;
  }
  function renderNotes() {
    const p = $("panel-notes");
    const notes = T.notes;
    const open = notes.filter((n) => !n.done);
    $("nNotes").textContent = open.length || "";
    p.innerHTML = "";
    const bar = document.createElement("div");
    bar.className = "notes-bar";
    const row = document.createElement("div");
    row.className = "notes-row";
    if (notes.length > 1) {
      const sw = document.createElement("span");
      sw.className = "seg";
      sw.innerHTML =
        '<button class="tb-btn' +
        (prefs.noteSort === "recent" ? "" : " active") +
        '" data-s="page" title="Top of the page first">Page order</button><button class="tb-btn' +
        (prefs.noteSort === "recent" ? " active" : "") +
        '" data-s="recent" title="Most recently written or edited first">Latest</button>';
      sw.querySelectorAll("[data-s]").forEach((b) =>
        b.addEventListener("click", () => {
          prefs.noteSort = b.dataset.s;
          savePrefs();
          renderNotes();
        }),
      );
      row.appendChild(sw);
    }
    if (open.length) {
      const cb = document.createElement("button");
      cb.className = "tb-btn copy-prompt";
      cb.textContent = "Copy as prompt";
      cb.title = "Copy every open note as one message to paste into an AI chat (Claude, ChatGPT or any other). Also under File → Export (⇧⌘R).";
      cb.addEventListener("click", copyRevisionPrompt);
      row.appendChild(cb);
    }
    if (row.children.length) bar.appendChild(row);
    p.appendChild(bar);
    const tg = document.createElement("label");
    tg.className = "mn-toggle";
    tg.title = "Also show each note beside the passage it points to. Needs Write mode and a wide window; the list here stays either way.";
    tg.innerHTML = '<span>Beside the page</span><input type="checkbox" role="switch"><span class="sw"></span>';
    const cbx = tg.querySelector("input");
    cbx.checked = !!prefs.marginNotes;
    cbx.addEventListener("change", () => setMarginNotes(cbx.checked));
    if (!notes.length) {
      p.insertAdjacentHTML(
        "beforeend",
        '<div class="panel-empty">Select some text and click <b>Add note</b> (or press <b>⇧⌘M</b>, or right-click) to leave a comment on it. The text is highlighted; the note lives here. Notes are kept by Edith, not inside your file.</div>',
      );
      T.noteSig = "";
      renderTrash(p);
      p.appendChild(tg);
      return;
    }
    const ordered = sortedOpen(T, open);
    T.noteSig = ordered.map((n) => n.id).join();
    ordered.concat(notes.filter((n) => n.done).sort((a, b) => b.created - a.created)).forEach((n) => {
      const kd = kindOf(n);
      const c = document.createElement("div");
      c.className = "note-card" + (n.done ? " done" : "") + (T.freshNote === n.id ? " fresh" : "");
      c.dataset.note = n.id;
      const q = document.createElement("div");
      q.className = "q";
      q.textContent = n.quote ? "“" + n.quote.replace(/\s+/g, " ") + "”" : "General note";
      q.title = n.quote ? "Jump to this text" : "";
      if (n.quote) q.addEventListener("click", () => jumpToNote(n));
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = n.text;
      const m = document.createElement("div");
      m.className = "m";
      m.innerHTML =
        (n.kind && KINDS[n.kind] ? '<span class="kind k-' + kd + '">' + KINDS[kd] + "</span>" : "") +
        "<span>" +
        new Date(n.created).toLocaleDateString([], { month: "short", day: "numeric" }) +
        '</span><button data-a="edit">Edit</button><button data-a="done" class="r">' +
        (n.done ? "Reopen" : "Resolve") +
        '</button><button data-a="del">Delete</button>';
      m.querySelector("[data-a=edit]").addEventListener("click", () => noteAction(n, "edit"));
      m.querySelector("[data-a=done]").addEventListener("click", () => noteAction(n, "done"));
      m.querySelector("[data-a=del]").addEventListener("click", () => {
        const tab = T;
        if (reduceMotion()) {
          noteAction(n, "del");
          return;
        }
        c.classList.add("leaving");
        setTimeout(() => {
          if (T === tab) noteAction(n, "del");
        }, 170);
      });
      c.addEventListener("click", (e) => {
        if (!e.target.closest("button") && n.quote) jumpToNote(n);
      });
      c.style.cursor = n.quote ? "pointer" : "default";
      c.append(q, t, m);
      p.appendChild(c);
    });
    renderTrash(p);
    p.appendChild(tg);
    T.freshNote = null;
  }
  function jumpToNote(n) {
    const root = isWW() ? wwPM() : mdPM();
    const mark = root.querySelector('.note-mark[data-note="' + n.id + '"]');
    if (mark) {
      pulseMark(n.id);
      const m2 = root.querySelector('.note-mark[data-note="' + n.id + '"]') || mark;
      m2.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!selectMatch(n.quote, 0)) message("That text isn’t in the document any more", "err");
  }
  function focusNoteCard(id) {
    const lc = T.lane && T.lane._cards && T.lane._cards.get(id);
    if (marginActive() && lc) {
      lc.classList.add("flash");
      setTimeout(() => lc.classList.remove("flash"), 1200);
      return;
    }
    setTab("notes");
    const card = document.querySelector('.note-card[data-note="' + id + '"]');
    if (!card) return;
    card.scrollIntoView({ block: "nearest" });
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1200);
  }

  // Notes beside the page (optional): each open note sits in a lane to the right of the passage it points to.
  const MN_MIN = 700;
  const marginActive = () => work.classList.contains("mn-on");
  function setMarginNotes(on) {
    prefs.marginNotes = !!on;
    savePrefs();
    document.querySelectorAll(".mn-toggle input").forEach((i) => {
      i.checked = prefs.marginNotes;
    });
    layoutMargin(true);
    if (on && T && !homeShown && !marginActive())
      message(isWW() ? "This window is too narrow to show notes beside the page" : "Notes show beside the page in Write mode");
  }
  let mnRaf = 0;
  function layoutMargin(now) {
    if (now) {
      cancelAnimationFrame(mnRaf);
      mnRaf = 0;
      doLayoutMargin();
      return;
    }
    if (!mnRaf)
      mnRaf = requestAnimationFrame(() => {
        mnRaf = 0;
        doLayoutMargin();
      });
  }
  function doLayoutMargin() {
    if (!T) return;
    const tab = T;
    const pm = isWW() && !homeShown ? wwPM() : null;
    const ok = !!(prefs.marginNotes && pm && pm.clientWidth >= MN_MIN);
    if (marginActive() !== ok) {
      const a = captureAnchor();
      work.classList.toggle("mn-on", ok);
      if (a) applyAnchor(a);
    }
    if (!ok) {
      if (tab.lane) tab.lane.hidden = true;
      return;
    }
    if (!tab.lane) {
      tab.lane = document.createElement("div");
      tab.lane.className = "margin-lane";
      tab.el.appendChild(tab.lane);
    }
    const lane = tab.lane;
    lane.hidden = false;
    const items = noteLayout(tab, tab.wwView.state.doc)
      .ranges.slice()
      .sort((a, b) => a.from - b.from);
    const sig = items.map((r) => r.n.id + "|" + r.n.text + "|" + kindOf(r.n)).join("\u0001");
    if (lane._sig !== sig) {
      buildLane(lane, items);
      lane._sig = sig;
    }
    // passages in content coordinates, stacked so neighbouring cards never overlap
    const pmTop = pm.getBoundingClientRect().top,
      sc = pm.scrollTop;
    let prev = -1e9;
    items.forEach((r) => {
      const card = lane._cards.get(r.n.id);
      const mark = pm.querySelector('.note-mark[data-note="' + r.n.id + '"]');
      if (!card) return;
      if (!mark) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      const top = Math.max(mark.getBoundingClientRect().top - pmTop + sc - 2, prev + 8);
      card._y = top;
      prev = top + card.offsetHeight;
    });
    positionMargin();
  }
  function positionMargin() {
    const tab = T;
    if (!tab || !tab.lane || tab.lane.hidden) return;
    const pm = wwPM();
    if (!pm) return;
    const off = pm.getBoundingClientRect().top - tab.lane.getBoundingClientRect().top - pm.scrollTop;
    tab.lane._cards.forEach((card) => {
      if (card._y != null) card.style.transform = "translateY(" + Math.round(card._y + off) + "px)";
    });
  }
  function buildLane(lane, items) {
    lane.innerHTML = "";
    lane._cards = new Map();
    const marksOf = (id) => [...wwPM().querySelectorAll('.note-mark[data-note="' + id + '"]')];
    items.forEach(({ n }) => {
      const kd = kindOf(n);
      const c = document.createElement("div");
      c.className = "mn-card k-" + kd;
      c.dataset.note = n.id;
      c.innerHTML =
        '<div class="mn-kind"></div><div class="mn-text"></div><div class="mn-actions"><button data-a="edit">Edit</button><button data-a="done">Resolve</button><button data-a="del">Delete</button></div>';
      c.querySelector(".mn-kind").textContent = KINDS[kd];
      c.querySelector(".mn-text").textContent = n.text;
      c.querySelectorAll("[data-a]").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          noteAction(n, b.dataset.a);
        }),
      );
      c.addEventListener("mouseenter", () => marksOf(n.id).forEach((m) => m.classList.add("focus")));
      c.addEventListener("mouseleave", () => marksOf(n.id).forEach((m) => m.classList.remove("focus")));
      c.addEventListener("click", () => pulseMark(n.id));
      lane.appendChild(c);
      lane._cards.set(n.id, c);
    });
  }
  $("btnNote").addEventListener("click", addNote);
  host.addEventListener("click", (e) => {
    const m = e.target.closest(".note-mark");
    if (m) focusNoteCard(m.dataset.note);
  });
  const bubble = $("noteBubble");
  function hideBubble() {
    bubble.hidden = true;
  }
  function maybeShowBubble() {
    const sel = window.getSelection();
    if (!T || homeShown || document.querySelector(".modal.on")) {
      hideBubble();
      return;
    }
    if (!sel.rangeCount || sel.isCollapsed || !host.contains(sel.anchorNode) || !selectedText()) {
      hideBubble();
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) {
      hideBubble();
      return;
    }
    bubble.hidden = false;
    const bw = bubble.offsetWidth || 100;
    bubble.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, rect.left + rect.width / 2 - bw / 2)) + "px";
    bubble.style.top = (rect.top > 130 ? rect.top - 40 : rect.bottom + 8) + "px";
  }
  host.addEventListener("mouseup", () => setTimeout(maybeShowBubble, 10));
  host.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.key.startsWith("Arrow")) setTimeout(maybeShowBubble, 10);
    else hideBubble();
  });
  document.addEventListener("mousedown", (e) => {
    if (!bubble.contains(e.target)) hideBubble();
  });
  bubble.addEventListener("mousedown", (e) => e.preventDefault());
  bubble.addEventListener("click", addNote);
  const ctx = $("ctxMenu");
  if (!native)
    host.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const has = !!selectedText() && !homeShown;
      ctx.querySelector("[data-ctx=note]").hidden = !has;
      ctx.querySelector("[data-ctx=copy]").hidden = !has;
      ctx.querySelector("[data-ctx=cut]").hidden = !has;
      ctx.hidden = false;
      ctx.style.left = Math.min(e.clientX, window.innerWidth - 200) + "px";
      ctx.style.top = Math.min(e.clientY, window.innerHeight - 150) + "px";
    });
  document.addEventListener("mousedown", (e) => {
    if (!ctx.contains(e.target)) ctx.hidden = true;
  });
  ctx.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ctx]");
    if (!b) return;
    ctx.hidden = true;
    if (b.dataset.ctx === "note") addNote();
    else if (b.dataset.ctx === "copy") document.execCommand("copy");
    else if (b.dataset.ctx === "cut") document.execCommand("cut");
    else if (b.dataset.ctx === "paste") {
      try {
        T.editor.insertText(await navigator.clipboard.readText());
      } catch (err) {
        message("Use ⌘V to paste", "err");
      }
    }
  });

  // =====================================================================
  // Editor behaviours: typing shortcuts, smart paste, scroll sync
  // =====================================================================
  function installTypingShortcuts(tab) {
    tab.wwView.setProps({
      handleTextInput(view, from, to, text) {
        if (text !== " " && text !== "`" && text !== "-") return false;
        const $from = view.state.selection.$from;
        if ($from.parent.type.name !== "paragraph" || $from.depth !== 1) return false;
        const before = $from.parent.textBetween(0, $from.parentOffset, "", ""),
          after = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, "", "");
        let cmd = null,
          payload,
          m;
        if (text === " ") {
          if ((m = before.match(/^(#{1,6})$/))) {
            cmd = "heading";
            payload = { level: m[1].length };
          } else if (/^[-*+]$/.test(before)) cmd = "bulletList";
          else if (/^\d{1,3}\.$/.test(before)) cmd = "orderedList";
          else if (/^\[( |x|X)?\]$/.test(before)) cmd = "taskList";
          else if (before === ">") cmd = "blockQuote";
        } else if (text === "`" && before === "``" && !after) cmd = "codeBlock";
        else if (text === "-" && before === "--" && !after) cmd = "hr";
        if (!cmd) return false;
        view.dispatch(view.state.tr.delete($from.start(), $from.pos));
        tab.editor.exec(cmd, payload);
        return true;
      },
    });
  }
  // Raw Markdown pasted into Write mode (e.g. copied from Claude) is rendered as formatting
  function looksLikeMarkdown(text) {
    if (!text || text.length < 3) return false;
    const lines = text.split("\n");
    let hits = 0;
    for (const l of lines) {
      if (/^\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,3}\.\s|>\s|```|\|.*\|\s*$|- \[[ xX]\]\s|---+\s*$)/.test(l)) hits++;
    }
    if (/\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|(^|\s)_[^_\n]+_(\s|$)/.test(text)) hits++;
    return hits >= (lines.length > 3 ? 2 : 1);
  }
  let mdRenderer = null,
    mdRendererEl = null;
  function markdownToHtml(md) {
    if (!mdRenderer) {
      mdRendererEl = document.createElement("div");
      mdRendererEl.style.cssText = "position:absolute;left:-99999px;top:0;width:800px";
      document.body.appendChild(mdRendererEl);
      mdRenderer = toastui.Editor.factory({ el: mdRendererEl, viewer: true, initialValue: "", usageStatistics: false });
    }
    mdRenderer.setMarkdown(md);
    const c = mdRendererEl.querySelector(".toastui-editor-contents");
    return c ? c.innerHTML : "";
  }
  function installSmartPaste(tab) {
    const pm = tab.el.querySelector(".toastui-editor-ww-container .ProseMirror");
    if (!pm) return;
    pm.addEventListener(
      "paste",
      (e) => {
        if (e.__edith) return;
        const cd = e.clipboardData;
        if (!cd) return;
        const html = cd.getData("text/html"),
          text = cd.getData("text/plain");
        if (!html && /\n/.test(text.trim()) && !looksLikeMarkdown(text)) {
          const v = tab.wwView;
          const chunks = text
            .replace(/\r/g, "")
            .split(/\n+/)
            .map((x) => x.trim())
            .filter(Boolean);
          if (chunks.length > 1 && inListItem(v) && v.state.selection.$from.parent.type.name === "paragraph") {
            e.preventDefault();
            e.stopImmediatePropagation();
            let tr = v.state.tr.deleteSelection();
            chunks.forEach((c, i) => {
              if (i) tr = tr.split(tr.selection.from, 2);
              tr = tr.insertText(c);
            });
            v.dispatch(tr.scrollIntoView());
            message("Pasted as separate bullets");
            return;
          }
        }
        if (html || !looksLikeMarkdown(text)) return;
        const converted = markdownToHtml(text);
        if (!converted) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        // Block-level Markdown pasted into a non-empty paragraph starts on its own line, like Google Docs
        const v = tab.wwView,
          $from = v.state.selection.$from;
        if (/^\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,3}\.\s|>\s|```|\||---)/.test(text) && $from.parent.isTextblock && $from.parent.content.size > 0)
          v.dispatch(v.state.tr.split($from.pos));
        const dt = new DataTransfer();
        dt.setData("text/html", converted);
        dt.setData("text/plain", text);
        const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
        ev.__edith = true;
        pm.dispatchEvent(ev);
        message("Pasted as formatted text");
      },
      true,
    );
  }
  // Markdown-mode preview follows the editor instantly instead of easing toward it
  function snapScrollSync(tab) {
    const ss = tab.editor.scrollSync;
    if (!ss || typeof ss.run !== "function") return;
    ss.run = function (from, target) {
      const el = from === "editor" ? this.previewEl : this.editorView.dom;
      this.blockedScroll = from === "editor" ? "preview" : "editor";
      el.scrollTop = target;
      clearTimeout(this.__rel);
      this.__rel = setTimeout(() => {
        this.blockedScroll = null;
      }, 60);
    };
  }

  // =====================================================================
  // History panel + version viewer
  // =====================================================================
  let diffVersion = null;
  async function renderHistory() {
    const p = $("panel-history");
    let vs = [];
    try {
      vs = await listVersions();
    } catch (e) {}
    $("nHistory").textContent = vs.length || "";
    p.innerHTML = '<div class="panel-actions"><button class="tb-btn" id="snapNow">Save a version now</button></div>';
    $("snapNow").addEventListener("click", async () => {
      if (await snapshot("Manual", true)) message("Version saved");
    });
    if (!vs.length) {
      p.insertAdjacentHTML(
        "beforeend",
        '<div class="panel-empty">No versions yet for this file. Each save keeps one, and an automatic version is taken every ' +
          prefs.verMinutes +
          " minutes while you edit.</div>",
      );
      return;
    }
    let day = "";
    vs.forEach((v) => {
      const d = new Date(v.at).toLocaleDateString([], { dateStyle: "medium" });
      if (d !== day) {
        day = d;
        p.insertAdjacentHTML("beforeend", '<div class="ver-day">' + d + "</div>");
      }
      const b = document.createElement("button");
      b.className = "ver";
      b.innerHTML = '<div class="l">' + fmtTime(v.at) + '<span class="tag"></span></div><div class="d"></div>';
      b.querySelector(".tag").textContent = v.label;
      b.querySelector(".d").textContent = fmtSize(v.size);
      b.addEventListener("click", () => showDiff(v.id));
      p.appendChild(b);
    });
  }
  async function showDiff(id) {
    const v = await getVersion(id);
    if (!v) return;
    diffVersion = v;
    $("diffTitle").textContent = "Version from " + fmtDate(v.at);
    const parts = Diff.diffLines(v.text, getDoc());
    let html = "",
      added = 0,
      removed = 0;
    parts.forEach((pt) => {
      if (pt.added) {
        added += pt.count;
        html += '<span class="d-add">' + escapeHtml(pt.value) + "</span>";
      } else if (pt.removed) {
        removed += pt.count;
        html += '<span class="d-del">' + escapeHtml(pt.value) + "</span>";
      } else {
        const ls = pt.value.split("\n");
        if (ls[ls.length - 1] === "") ls.pop();
        if (ls.length > 8)
          html +=
            '<span class="d-ctx">' +
            escapeHtml(ls.slice(0, 3).join("\n")) +
            '</span>\n<span class="d-skip">… ' +
            (ls.length - 6) +
            ' unchanged lines …</span>\n<span class="d-ctx">' +
            escapeHtml(ls.slice(-3).join("\n")) +
            "</span>\n";
        else html += '<span class="d-ctx">' + escapeHtml(pt.value) + "</span>";
      }
    });
    $("diffSub").textContent =
      added || removed
        ? "Struck = only in this version; highlighted = only in current. " + removed + " / " + added + " lines."
        : "Identical to the current text";
    $("diffBody").innerHTML = html || '<span class="d-ctx">(empty)</span>';
    $("diffFull").textContent = v.text;
    setDiffView("changes");
    openModal("mDiff");
  }
  function setDiffView(v) {
    document.querySelectorAll("[data-dview]").forEach((b) => b.classList.toggle("active", b.dataset.dview === v));
    $("diffBody").hidden = v !== "changes";
    $("diffFull").hidden = v !== "full";
  }
  document.querySelectorAll("[data-dview]").forEach((b) => b.addEventListener("click", () => setDiffView(b.dataset.dview)));
  $("diffRestore").addEventListener("click", async () => {
    if (!diffVersion) return;
    await snapshot("Before restore", true);
    loadIntoTab(T, diffVersion.text, T.name, { keepRef: true, keepNotes: true });
    setDirty(serialize() !== T.lastSavedText);
    hideModal($("mDiff"));
    message("Restored version from " + fmtDate(diffVersion.at));
  });
  $("diffDelete").addEventListener("click", async () => {
    if (!diffVersion) return;
    await deleteVersion(diffVersion.id);
    hideModal($("mDiff"));
    renderHistory();
  });
  $("diffCopy").addEventListener("click", async () => {
    if (!diffVersion) return;
    await navigator.clipboard.writeText(diffVersion.text);
    message("Copied");
  });

  // =====================================================================
  // Loading, saving, importing
  // =====================================================================
  function loadIntoTab(tab, text, name, opts) {
    opts = opts || {};
    const split = splitNotes(text);
    tab.editor.setMarkdown(split.text.replace(/\s+$/, ""), false);
    if (!opts.keepNotes) tab.notes = split.notes;
    else if (split.notes.length) tab.notes = split.notes;
    tab.name = name;
    if (!opts.keepRef) tab.fileRef = opts.fileRef || null;
    tab.editor.moveCursorToStart(false);
    tab.el.querySelectorAll(".ProseMirror").forEach((el) => {
      const sp = scrollParent(el);
      if (sp) sp.scrollTop = 0;
    });
    tab.cachedMd = tab.editor.getMarkdown();
    tab.lastSnapshotText = null;
    if (tab === T) {
      fnameEl.value = name;
      refreshDecorations();
      renderNotes();
      buildOutline(tab.cachedMd);
      updateStats(tab.cachedMd);
      renderHistory();
      updateAutosaveTip();
    }
    renderTabs();
  }
  function markSaved(tab) {
    tab = tab || T;
    if (tab.fileRef) tab.scratch = false;
    if (tab === T) syncScratchUI();
    tab.lastSavedText = serializeTab(tab);
    if (tab === T) setDirty(false);
    else {
      tab.dirty = false;
      renderTabs();
    }
  }
  const CONVERTIBLE = ["docx", "pdf", "html", "htm", "doc", "rtf"];
  async function targetTab() {
    return T && isPristine(T) ? T : newTab();
  }
  const needT = () => {
    if (!T) {
      message("Open or create a document first");
      return false;
    }
    return true;
  };
  async function openFromRef(ref) {
    if (ref.path) {
      const already = tabs.find((t) => t.fileRef && t.fileRef.path === ref.path);
      if (already) {
        await activateTab(already);
        return;
      }
      const r = await native.readFile(ref.path);
      if (!r.ok) {
        message("Could not open " + baseName(ref.path) + ": " + r.error, "err");
        return;
      }
      await openBlob(new File([r.bytes], baseName(ref.path)), Object.assign({ mtime: r.mtime }, ref));
      return;
    }
    const h = ref.handle;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm !== "granted" && (await h.requestPermission({ mode: "readwrite" })) !== "granted") {
      message("Permission to open the file was declined", "err");
      return;
    }
    await openBlob(await h.getFile(), ref);
  }
  async function openBlob(f, ref) {
    if (CONVERTIBLE.includes(extOf(f.name))) {
      await importFile(f);
      return;
    }
    const tab = await targetTab();
    if (tab !== T) await activateTab(tab);
    loadIntoTab(tab, await f.text(), f.name, { fileRef: ref ? { path: ref.path, handle: ref.handle } : null });
    markSaved(tab);
    tab.importedFrom = null;
    tab.fileMtime = (ref && ref.mtime) || null;
    await adoptNotes(tab);
    rememberRecent(f.name, tab.fileRef);
    message("Opened " + f.name);
    tab.editor.focus();
    saveSession();
  }
  const openPath = (p) => openFromRef({ path: p });
  async function openFile() {
    if (native) {
      const p = await native.openDialog("document");
      if (p) await openFromRef({ path: p });
      return;
    }
    if (hasFSA) {
      try {
        const [h] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Documents",
              accept: {
                "text/markdown": [".md", ".markdown", ".txt"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                "application/pdf": [".pdf"],
                "application/rtf": [".rtf"],
                "text/html": [".html", ".htm"],
              },
            },
          ],
        });
        await openFromRef({ handle: h });
      } catch (e) {
        if (e.name !== "AbortError") message("Could not open: " + e.message, "err");
      }
      return;
    }
    $("fileInput").click();
  }
  $("fileInput").addEventListener("change", async () => {
    const f = $("fileInput").files[0];
    $("fileInput").value = "";
    if (f) await openBlob(f, null);
  });

  async function saveFile(forceAs, quiet) {
    if (!needT()) return;
    const tab = T;
    clearTimeout(tab.timers.autosave);
    tab.timers.autosave = null;
    const text = serializeTab(tab);
    let name = ensureExt(tab.name.trim() || "untitled.md");
    tab.name = name;
    fnameEl.value = name;
    const after = async (savedName) => {
      tab.lastSavedText = text;
      if (tab === T) setDirty(false);
      else tab.dirty = false;
      persistNotes(tab, true);
      rememberRecent(savedName, tab.fileRef);
      renderHistory();
      renderTabs();
      updateAutosaveTip();
      saveSession();
      if (!quiet) {
        flashBtn($("btnSave"));
        await snapshot("Saved");
        message("Saved " + savedName, "saved");
      } else message("Autosaved " + fmtTime(Date.now()), "saved");
    };
    if (native) {
      if (!tab.fileRef || !tab.fileRef.path || forceAs) {
        if (quiet) return;
        const p = await native.saveDialog(name);
        if (!p) return;
        const oldKey = keyOf(tab);
        tab.fileRef = { path: p };
        tab.name = baseName(p);
        fnameEl.value = tab.name;
        tab.fileMtime = null;
        showImages(tab);
        await rekeyVersions(oldKey, keyOf(tab));
      } else if (tab.fileMtime) {
        const st = await native.stat(tab.fileRef.path);
        if (st.ok && Math.abs(st.mtime - tab.fileMtime) > 1000) {
          if (quiet) {
            tab.externalChange = true;
            message("This file was changed by another app — press ⌘S to decide what to keep", "err");
            return;
          }
          const choice = await native.askThree(
            "“" + tab.name + "” was changed by another app since you opened it.",
            "Overwrite it with your version, or reload the version on disk? Reloading keeps your current text in version history.",
            ["Overwrite", "Cancel", "Reload from disk"],
          );
          if (choice === 1) return;
          if (choice === 2) {
            await snapshot("Before reload", true);
            const rr = await native.readFile(tab.fileRef.path);
            if (rr.ok) {
              loadIntoTab(tab, new TextDecoder().decode(rr.bytes), tab.name, { keepRef: true, keepNotes: true });
              markSaved(tab);
              tab.fileMtime = st.mtime;
              message("Reloaded from disk");
            }
            return;
          }
        }
      }
      const r = await native.writeFile(tab.fileRef.path, text);
      if (!r.ok) {
        message("Could not save: " + r.error, "err");
        return;
      }
      tab.fileMtime = r.mtime || tab.fileMtime;
      tab.externalChange = false;
      await after(tab.name);
      return;
    }
    if (hasFSA) {
      try {
        if (!tab.fileRef || !tab.fileRef.handle || forceAs) {
          if (quiet) return;
          const h = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown"] } }],
          });
          const oldKey = keyOf(tab);
          tab.fileRef = { handle: h };
          tab.name = h.name;
          fnameEl.value = tab.name;
          await rekeyVersions(oldKey, keyOf(tab));
        }
        const w = await tab.fileRef.handle.createWritable();
        await w.write(text);
        await w.close();
        await after(tab.name);
      } catch (e) {
        if (e.name !== "AbortError") message("Could not save: " + e.message, "err");
      }
      return;
    }
    if (quiet) return;
    download(name, text, "text/markdown");
    tab.lastSavedText = text;
    setDirty(false);
    flashBtn($("btnSave"));
    await snapshot("Saved");
    message("Downloaded " + name + " to your Downloads folder", "saved");
  }
  $("btnSave").addEventListener("click", () => saveFile(false));

  // ---- Import: DOCX / PDF / HTML / TXT → Markdown
  function makeTurndown() {
    const td = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
      hr: "---",
    });
    td.use(turndownPluginGfm.gfm);
    td.addRule("strip-empty", {
      filter: (n) => (n.nodeName === "P" || n.nodeName === "SPAN") && !n.textContent.trim() && !n.querySelector("img"),
      replacement: () => "",
    });
    return td;
  }
  function prepHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("table").forEach((t) => {
      if (t.querySelector("th")) return;
      const first = t.querySelector("tr");
      if (!first) return;
      first.querySelectorAll("td").forEach((td) => {
        const th = doc.createElement("th");
        th.innerHTML = td.innerHTML;
        td.replaceWith(th);
      });
      const thead = doc.createElement("thead");
      thead.appendChild(first);
      t.insertBefore(thead, t.firstChild);
    });
    doc.querySelectorAll("td p, th p").forEach((p) => {
      if (p.parentElement.children.length === 1) p.replaceWith(...p.childNodes);
    });
    return doc.body.innerHTML;
  }
  const tidyMd = (md) =>
    md
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+/, "") + "\n";
  async function docxToMd(buf) {
    const r = await mammoth.convertToHtml(
      { arrayBuffer: buf },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => p:fresh",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote:fresh",
          "r[style-name='Strong'] => strong",
          "p[style-name='Code'] => pre:fresh",
        ],
        includeDefaultStyleMap: true,
      },
    );
    const warn = r.messages.filter((m) => m.type === "warning").length;
    return { md: tidyMd(makeTurndown().turndown(prepHtml(r.value))), note: warn ? warn + " element(s) had no Markdown equivalent and were simplified." : "" };
  }
  // RTF reader: text, bold/italic/strikethrough, type sizes (→ headings), bullets and numbers, links and special characters.
  // The result is HTML, which then takes the same road to Markdown as Word and HTML files.
  function rtfToHtml(rtf) {
    const SKIP = new Set([
      "fonttbl",
      "colortbl",
      "stylesheet",
      "info",
      "pict",
      "header",
      "headerl",
      "headerr",
      "headerf",
      "footer",
      "footerl",
      "footerr",
      "footerf",
      "listtable",
      "listoverridetable",
      "rsidtbl",
      "generator",
      "expandedcolortbl",
      "filetbl",
      "revtbl",
      "themedata",
      "colorschememapping",
      "latentstyles",
      "datastore",
      "xmlnstbl",
      "object",
      "private",
      "pgptbl",
      "fldtype",
      "bkmkstart",
      "bkmkend",
      "shpinst",
      "nonshppict",
    ]);
    const SPECIAL = {
      emdash: "—",
      endash: "–",
      bullet: "•",
      lquote: "‘",
      rquote: "’",
      ldblquote: "“",
      rdblquote: "”",
      emspace: " ",
      enspace: " ",
      qmspace: " ",
    };
    const win1252 = (b) => {
      try {
        return new TextDecoder("windows-1252").decode(Uint8Array.of(b));
      } catch (e) {
        return String.fromCharCode(b);
      }
    };
    const paras = [];
    let cur = { runs: [], marker: null, lvl: 0 };
    const stack = [];
    let st = { skip: 0, b: 0, i: 0, s: 0, fs: 24, uc: 1, href: null, cap: "", fld: 0 };
    let listBuf = "",
      fldBuf = "",
      skipChars = 0;
    const endPara = () => {
      if (cur.runs.length) paras.push(cur);
      cur = { runs: [], marker: null, lvl: 0 };
    };
    const emit = (t) => {
      if (st.skip || !t) return;
      if (st.cap === "list") {
        listBuf += t;
        return;
      }
      if (st.fld) {
        fldBuf += t;
        return;
      }
      cur.runs.push({ t, b: st.b, i: st.i, s: st.s, fs: st.fs, href: st.href });
    };
    const n = rtf.length;
    const wordRe = /\\([a-zA-Z]+)(-?\d+)?[ ]?/y;
    const textRe = /[^\\{}\r\n]+/y;
    let i = 0;
    while (i < n) {
      const ch = rtf[i];
      if (ch === "{") {
        stack.push(st);
        st = Object.assign({}, st);
        i++;
        const mm = /^\\(\*\s*\\)?([a-zA-Z]+)/.exec(rtf.slice(i, i + 40));
        if (mm) {
          if (mm[2] === "fldinst") {
            st.fld = 1;
            fldBuf = "";
          } else if (mm[2] === "listtext" || mm[2] === "pntext") {
            st.cap = "list";
            listBuf = "";
          } else if (mm[1] || SKIP.has(mm[2])) st.skip = 1;
        }
        continue;
      }
      if (ch === "}") {
        const closing = st;
        st = stack.pop() || st;
        i++;
        if (closing.cap === "list" && st.cap !== "list") {
          cur.marker = listBuf.trim();
          listBuf = "";
        }
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        i++;
        continue;
      }
      if (ch !== "\\") {
        textRe.lastIndex = i;
        const m = textRe.exec(rtf);
        let t = m[0];
        i += t.length;
        if (skipChars) {
          const k = Math.min(skipChars, t.length);
          skipChars -= k;
          t = t.slice(k);
        }
        emit(t);
        continue;
      }
      const nx = rtf[i + 1];
      if (nx === "\\" || nx === "{" || nx === "}") {
        emit(nx);
        i += 2;
        continue;
      }
      if (nx === "'") {
        const code = parseInt(rtf.substr(i + 2, 2), 16);
        i += 4;
        if (skipChars) {
          skipChars--;
          continue;
        }
        emit(win1252(code));
        continue;
      }
      if (nx === "\n" || nx === "\r") {
        endPara();
        i += 2;
        continue;
      }
      if (nx === "~") {
        emit(" ");
        i += 2;
        continue;
      }
      if (nx === "_") {
        emit("-");
        i += 2;
        continue;
      }
      if (nx === "-" || nx === "*" || nx === ":" || nx === "|") {
        i += 2;
        continue;
      }
      wordRe.lastIndex = i;
      const m = wordRe.exec(rtf);
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const w = m[1],
        p = m[2];
      if (st.skip) continue;
      if (w === "par" || w === "sect" || w === "page" || w === "row") endPara();
      else if (w === "line") emit("\n");
      else if (w === "tab" || w === "cell") emit(" ");
      else if (w === "pard") {
        cur.marker = null;
        cur.lvl = 0;
      } else if (w === "ilvl") cur.lvl = +p || 0;
      else if (w === "plain") {
        st.b = st.i = st.s = 0;
      } else if (w === "b") st.b = p === "0" ? 0 : 1;
      else if (w === "i") st.i = p === "0" ? 0 : 1;
      else if (w === "strike") st.s = p === "0" ? 0 : 1;
      else if (w === "fs") st.fs = +p || 24;
      else if (w === "uc") st.uc = +p || 0;
      else if (w === "u") {
        let c = +p;
        if (c < 0) c += 65536;
        emit(String.fromCharCode(c));
        skipChars = st.uc;
      } else if (w === "fldrslt") {
        const h = /HYPERLINK\s+"([^"]+)"/i.exec(fldBuf);
        st.href = h ? h[1] : null;
      } else if (SPECIAL[w]) emit(SPECIAL[w]);
    }
    endPara();
    // body size = the size carrying the most text
    const bySize = {};
    paras.forEach((pp) =>
      pp.runs.forEach((r) => {
        bySize[r.fs] = (bySize[r.fs] || 0) + r.t.length;
      }),
    );
    const body = +Object.keys(bySize).sort((a, b) => bySize[b] - bySize[a])[0] || 24;
    const html = [];
    const ls = [];
    const closeLists = (to) => {
      while (ls.length && ls[ls.length - 1].lvl > to) html.push("</li></" + ls.pop().tag + ">");
    };
    const inline = (runs) => {
      const parts = [];
      runs.forEach((r) => {
        const key = [r.b, r.i, r.s, r.href].join("|"),
          last = parts[parts.length - 1];
        if (last && last.key === key) last.t += r.t;
        else parts.push({ key, r, t: r.t });
      });
      return parts
        .map(({ r, t }) => {
          let h = escapeHtml(t).replace(/\n/g, "<br>");
          if (!t.trim()) return h;
          const lead = h.match(/^\s*/)[0],
            trail = h.match(/\s*$/)[0];
          h = h.trim();
          if (r.b) h = "<strong>" + h + "</strong>";
          if (r.i) h = "<em>" + h + "</em>";
          if (r.s) h = "<s>" + h + "</s>";
          if (r.href) h = '<a href="' + escapeHtml(r.href) + '">' + h + "</a>";
          return lead + h + trail;
        })
        .join("");
    };
    paras.forEach((pp) => {
      const text = pp.runs.map((r) => r.t).join("");
      if (!text.trim()) return;
      const mk = pp.marker;
      const ul = mk && /^[•◦▪▫●○■□‣·*–—-]/.test(mk),
        ol = mk && !ul && /^(\d+|[a-zA-Z]|[ivxIVX]+)[.)]/.test(mk);
      if (ul || ol) {
        const tag = ul ? "ul" : "ol",
          lvl = pp.lvl;
        closeLists(lvl);
        const top = ls[ls.length - 1];
        if (top && top.lvl === lvl) {
          if (top.tag === tag) html.push("</li><li>");
          else {
            html.push("</li></" + ls.pop().tag + "><" + tag + "><li>");
            ls.push({ tag, lvl });
          }
        } else {
          html.push("<" + tag + "><li>");
          ls.push({ tag, lvl });
        }
        html.push(inline(pp.runs));
        return;
      }
      closeLists(-1);
      const inked = pp.runs.filter((r) => r.t.trim());
      const big = Math.max(...inked.map((r) => r.fs)),
        allBold = inked.every((r) => r.b);
      const level = text.length <= 140 ? (big >= body * 1.6 ? 1 : big >= body * 1.3 ? 2 : big >= body * 1.12 && allBold ? 3 : 0) : 0;
      html.push(
        level ? "<h" + level + ">" + inline(pp.runs.map((r) => Object.assign({}, r, { b: 0 }))) + "</h" + level + ">" : "<p>" + inline(pp.runs) + "</p>",
      );
    });
    closeLists(-1);
    return "<body>" + html.join("") + "</body>";
  }
  function htmlToMd(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav,footer,header,noscript,iframe").forEach((n) => n.remove());
    const root = doc.querySelector("article, main") || doc.body;
    return tidyMd(makeTurndown().turndown(prepHtml(root.innerHTML)));
  }
  // pdf.js runs in a worker built from the inlined worker source (allowed by the page's worker-src blob:)
  async function pdfToMd(buf, onProgress) {
    if (!pdfjsLib.GlobalWorkerOptions.workerPort)
      pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(new Blob([$("pdfWorkerSrc").textContent], { type: "text/javascript" })));
    const pdf = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    const pages = [];
    const fontOfName = (styles, name) => (styles && styles[name] && styles[name].fontFamily) || name || "";
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress("Reading page " + p + " of " + pdf.numPages);
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const vp = page.getViewport({ scale: 1 });
      const pageH = vp.height,
        pageW = vp.width;
      const items = tc.items.filter((it) => it.str !== undefined && it.transform);
      const lines = [];
      // group glyph runs into lines by baseline
      items.forEach((it) => {
        const size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
        const y = it.transform[5],
          x = it.transform[4];
        let ln = null;
        for (let i = lines.length - 1; i >= 0 && i >= lines.length - 12; i--) {
          if (Math.abs(lines[i].y - y) < Math.max(2, size * 0.35) && Math.abs(lines[i].x1 - x) < pageW * 0.5) {
            ln = lines[i];
            break;
          }
        }
        if (!ln) {
          ln = { y, items: [], size: 0, x0: x, x1: x };
          lines.push(ln);
        }
        const fname = it.fontName || "";
        const fam = fontOfName(tc.styles, fname);
        ln.items.push({
          x,
          w: it.width,
          str: it.str,
          size,
          font: fname,
          bold: /bold|black|heavy|semibold|demi/i.test(fam + " " + fname),
          italic: /italic|oblique/i.test(fam + " " + fname),
        });
        if (it.str.trim()) ln.size = Math.max(ln.size, size);
        ln.x0 = Math.min(ln.x0, x);
        ln.x1 = Math.max(ln.x1, x + (it.width || 0));
      });
      lines.forEach((l) => {
        l.items.sort((a, b) => a.x - b.x);
        let text = "",
          lastEnd = null;
        l.items.forEach((it) => {
          if (!it.str) return;
          if (lastEnd !== null && it.x - lastEnd > it.size * 0.18 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
          text += it.str;
          lastEnd = it.x + it.w;
        });
        l.text = text.replace(/\s+/g, " ").trim();
        const inked = l.items.filter((i) => i.str.trim());
        l.bold = inked.length > 0 && inked.every((i) => i.bold);
        l.italic = inked.length > 0 && inked.every((i) => i.italic);
        l.font = inked.length ? inked[0].font : "";
        l.edge = l.y < pageH * 0.09 || l.y > pageH * 0.91;
        l.width = l.x1 - l.x0;
      });
      const kept = lines.filter((l) => l.text);
      // two-column pages: split by the page's horizontal midpoint and read left column first
      const mid = pageW / 2;
      const left = kept.filter((l) => l.x0 < mid * 0.9 && l.x1 <= mid * 1.05),
        right = kept.filter((l) => l.x0 >= mid * 0.9);
      const twoCol =
        kept.length >= 8 && left.length >= kept.length * 0.3 && right.length >= kept.length * 0.3 && [...left, ...right].every((l) => l.width < pageW * 0.55);
      let ordered;
      if (twoCol) {
        const span = kept.filter((l) => !left.includes(l) && !right.includes(l));
        const bySort = (a) => a.sort((m, n) => n.y - m.y);
        ordered = [
          ...bySort(span.filter((l) => l.y > Math.max(...left.map((q) => q.y), 0))),
          ...bySort(left),
          ...bySort(right),
          ...bySort(span.filter((l) => l.y <= Math.max(...left.map((q) => q.y), 0))),
        ];
      } else ordered = kept.sort((a, b) => b.y - a.y);
      pages.push(ordered);
    }
    // body font: the font+size that carries the most characters
    const fontCount = {},
      sizeCount = {};
    pages.flat().forEach((l) => {
      const k = Math.round(l.size * 2) / 2;
      sizeCount[k] = (sizeCount[k] || 0) + l.text.length;
      fontCount[l.font] = (fontCount[l.font] || 0) + l.text.length;
    });
    const body = +Object.keys(sizeCount).sort((a, b) => sizeCount[b] - sizeCount[a])[0] || 11;
    const bodyFont = Object.keys(fontCount).sort((a, b) => fontCount[b] - fontCount[a])[0] || "";
    const bigSizes = Object.keys(sizeCount)
      .map(Number)
      .filter((s) => s >= body * 1.15)
      .sort((a, b) => b - a);
    // running heads / footers: repeated text near the page edges, and bare page numbers
    const freq = {};
    pages.forEach((ls) => {
      const seen = new Set();
      ls.forEach((l) => {
        if (!l.edge) return;
        const k = l.text.replace(/\d+/g, "#");
        if (!seen.has(k)) {
          seen.add(k);
          freq[k] = (freq[k] || 0) + 1;
        }
      });
    });
    const isNoise = (l) => {
      const t = l.text;
      return (
        /^\d{1,4}$/.test(t) ||
        /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(t) ||
        (l.edge && pages.length >= 2 && freq[t.replace(/\d+/g, "#")] >= Math.max(2, pages.length * 0.5) && t.length < 100)
      );
    };
    const NUMBERED = /^((chapter|section|unit|part|lesson|module|appendix)\s+[\divxlc]+\b|\d{1,2}(\.\d{1,2}){0,3}\s+\S)/i;
    const out = [];
    let para = "";
    const flush = () => {
      if (para) {
        out.push(para.trim());
        para = "";
      }
    };
    const lvlOf = (l) => {
      const k = Math.round(l.size * 2) / 2;
      const bi = bigSizes.indexOf(k);
      if (bi >= 0) return Math.min(bi + 1, 3);
      const m = l.text.match(/^(\d{1,2})(\.\d{1,2}){0,3}\s/);
      if (m) return Math.min((l.text.match(/\./g) || []).length + 1, 4);
      return 3;
    };
    pages.forEach((ls) => {
      let prev = null;
      ls.forEach((l, idx) => {
        if (isNoise(l)) return;
        const k = Math.round(l.size * 2) / 2;
        const short = l.text.length <= 90 && !/[.,;:]$/.test(l.text);
        const next = ls[idx + 1];
        const gapAfter = next ? l.y - next.y : 99;
        const spaced = gapAfter > l.size * 1.35;
        const caps = short && l.text.length >= 4 && l.text === l.text.toUpperCase() && /[A-Z]{3}/.test(l.text) && !/\d{3,}/.test(l.text);
        const fontChange = l.font && bodyFont && l.font !== bodyFont && !l.italic;
        const numbered = NUMBERED.test(l.text) && short;
        const bigger = k >= body * 1.15;
        // a heading needs to be short and carry at least one typographic signal; caption-like italics never qualify
        const isHeading =
          short &&
          !l.italic &&
          (bigger ||
            (l.bold && (spaced || numbered || caps || fontChange)) ||
            (numbered && (l.bold || fontChange || spaced)) ||
            (caps && (l.bold || fontChange || k >= body * 1.05)) ||
            (fontChange && spaced && k >= body));
        if (isHeading) {
          flush();
          out.push("#".repeat(lvlOf(l)) + " " + l.text.replace(/\s+/g, " "));
          prev = l;
          return;
        }
        if (l.italic && /^(figure|fig\.|table|source|photo|image)\b/i.test(l.text)) {
          flush();
          out.push("*" + l.text + "*");
          prev = l;
          return;
        }
        const bullet = l.text.match(/^[•◦▪▫●○■□‣–—-]\s*(.+)/),
          num = l.text.match(/^(\d{1,3})[.)]\s+(.+)/);
        if (bullet) {
          flush();
          out.push("- " + bullet[1]);
          prev = l;
          return;
        }
        if (num && num[2].length < 200 && !NUMBERED.test(l.text)) {
          flush();
          out.push(num[1] + ". " + num[2]);
          prev = l;
          return;
        }
        const gap = prev ? prev.y - l.y : 0;
        const continues = prev && gap > 0 && (gap < l.size * 1.45 || (gap < l.size * 1.7 && !/^[A-Z]/.test(l.text)));
        if (!continues) flush();
        if (para.endsWith("-") && /^[a-z]/.test(l.text)) para = para.slice(0, -1) + l.text;
        else para += (para ? " " : "") + l.text;
        prev = l;
      });
      flush();
      prev = null;
    });
    // merge paragraphs that were split across a column or page boundary mid-sentence
    const merged = [];
    out.forEach((blk) => {
      const last = merged[merged.length - 1];
      if (last && !/^[#\-*\d]/.test(last) && !/^[#\-*]/.test(blk) && !/[.!?:"”)\]]$/.test(last) && /^[a-z]/.test(blk))
        merged[merged.length - 1] = last + " " + blk;
      else merged.push(blk);
    });
    return { md: tidyMd(merged.join("\n\n")), note: "PDF text was reconstructed from the layout — check headings and lists." };
  }
  async function importFile(f) {
    const ext = extOf(f.name);
    $("busyTitle").textContent = "Converting " + f.name;
    $("busyText").textContent = "This runs entirely on your Mac. Nothing is uploaded.";
    $("mBusy").classList.add("on");
    try {
      let res;
      if (ext === "docx") res = await docxToMd(await f.arrayBuffer());
      else if (ext === "pdf")
        res = await pdfToMd(await f.arrayBuffer(), (t) => {
          $("busyText").textContent = t;
        });
      else if (ext === "html" || ext === "htm") res = { md: htmlToMd(await f.text()), note: "" };
      else if (ext === "rtf")
        res = {
          md: htmlToMd(rtfToHtml(new TextDecoder("windows-1252").decode(await f.arrayBuffer()))),
          note: "Rich Text formatting was simplified — check headings and lists.",
        };
      else if (ext === "doc") throw new Error("Old .doc files aren’t supported. Open it in Word or Pages and save as .docx first.");
      else res = { md: await f.text(), note: "" };
      if (!res.md.trim()) throw new Error("No text could be extracted. If this is a scanned PDF it contains images rather than text.");
      $("mBusy").classList.remove("on");
      const tab = await targetTab();
      if (tab !== T) await activateTab(tab);
      loadIntoTab(tab, res.md, ensureExt(f.name), { fileRef: null });
      tab.importedFrom = f.name;
      tab.lastSavedText = "";
      setDirty(true);
      await snapshot("Imported from " + ext.toUpperCase(), true);
      message("Converted " + f.name + " — review, then Save to choose where it goes." + (res.note ? " " + res.note : ""));
      tab.editor.focus();
      saveSession();
    } catch (e) {
      message("Import failed: " + e.message, "err");
    } finally {
      $("mBusy").classList.remove("on");
    }
  }
  async function importDialog() {
    if (native) {
      const p = await native.openDialog("import");
      if (!p) return;
      const r = await native.readFile(p);
      if (!r.ok) {
        message("Could not open: " + r.error, "err");
        return;
      }
      await importFile(new File([r.bytes], baseName(p)));
      return;
    }
    if (hasFSA) {
      try {
        const [h] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Word, PDF, HTML or text",
              accept: {
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                "application/pdf": [".pdf"],
                "text/html": [".html", ".htm"],
                "text/plain": [".txt"],
              },
            },
          ],
        });
        await importFile(await h.getFile());
      } catch (e) {
        if (e.name !== "AbortError") message("Could not open: " + e.message, "err");
      }
      return;
    }
    $("fileInput").click();
  }

  // ---- Export
  function exportHtml() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      escapeHtml(T.name) +
      "</title><style>body{font-family:" +
      v("--doc-font") +
      ";font-size:" +
      v("--doc-size") +
      ";line-height:" +
      v("--doc-lh") +
      ";color:" +
      v("--ink") +
      ";background:" +
      v("--surface") +
      ";max-width:" +
      v("--doc-width") +
      ";margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.25}h2{border-bottom:1px solid " +
      v("--line") +
      ";padding-bottom:.2em}a{color:" +
      v("--accent") +
      "}code{font-family:" +
      v("--mono") +
      ";background:" +
      v("--code-bg") +
      ";padding:.1em .3em;border-radius:4px;font-size:.9em}pre{background:" +
      v("--code-bg") +
      ";padding:14px;border-radius:6px;overflow:auto}pre code{background:none;padding:0}blockquote{border-left:3px solid " +
      v("--accent") +
      ";margin:0;padding:.2em 1em;color:" +
      v("--ink-2") +
      "}table{border-collapse:collapse}th,td{border:1px solid " +
      v("--line") +
      ";padding:6px 12px}th{background:" +
      v("--surface-2") +
      "}img{max-width:100%}@media print{body{background:#fff;color:#000;margin:0;max-width:none}}</style></head><body>" +
      docHtml() +
      "</body></html>"
    );
  }
  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Print applies the on-screen picture rules to a copy of the page; a web picture becomes its alt text.
  function printHtml() {
    const d = new DOMParser().parseFromString(exportHtml(), "text/html"),
      base = imgBase(T);
    d.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (WEB_IMG.test(src)) {
        const s = d.createElement("span");
        s.className = "img-web";
        s.textContent = img.getAttribute("alt") || "Image from the web";
        img.replaceWith(s);
      } else {
        const out = shownImageSrc(src, "", base);
        if (out) img.setAttribute("src", out);
      }
    });
    d.head.insertAdjacentHTML(
      "beforeend",
      "<style>.img-web{display:inline-block;padding:1px 9px;border:1px dashed #b8b0a0;border-radius:5px;color:#7a7264;font-size:.85em}</style>",
    );
    return "<!DOCTYPE html>" + d.documentElement.outerHTML;
  }
  function printDoc() {
    const fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(fr);
    fr.srcdoc = printHtml();
    fr.onload = () => {
      try {
        fr.contentWindow.focus();
        fr.contentWindow.print();
      } catch (e) {
        message("Print failed: " + e.message, "err");
      }
      setTimeout(() => fr.remove(), 60000);
    };
  }
  async function copyRich() {
    const html = docHtml(),
      text = getDoc();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
      ]);
    } catch (e) {
      const tmp = document.createElement("div");
      tmp.contentEditable = "true";
      tmp.style.cssText = "position:fixed;left:-9999px;top:0";
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      const r = document.createRange();
      r.selectNodeContents(tmp);
      selectDomRange(r);
      const ok = document.execCommand("copy");
      tmp.remove();
      T.editor.focus();
      if (!ok) {
        message("Could not copy: " + e.message, "err");
        return;
      }
    }
    message("Copied as formatted text — paste into Google Docs, Slack or email");
  }
  async function showRecent() {
    const rs = await listRecent();
    const b = $("recentBody");
    b.innerHTML = "";
    if (!rs.length) b.innerHTML = "<p>Nothing yet. Files you open or save will show up here.</p>";
    rs.forEach((r) => {
      const row = document.createElement("div");
      row.className = "recent-row";
      const btn = document.createElement("button");
      btn.className = "open";
      btn.textContent = r.label || r.name;
      btn.title = r.path || "";
      btn.addEventListener("click", async () => {
        hideModal($("mRecent"));
        if (r.path || r.handle) {
          try {
            await openFromRef(r.path ? { path: r.path } : { handle: r.handle });
          } catch (e) {
            message("Could not reopen " + (r.label || r.name) + " — it may have moved. " + e.message, "err");
          }
        } else message("That file was opened without write access; use Open to find it again.", "err");
      });
      const d = document.createElement("span");
      d.className = "d";
      d.textContent = fmtDate(r.at);
      row.append(btn, d);
      b.appendChild(row);
    });
    openModal("mRecent");
  }
  // A copy for sharing is just the text; the notes (a hidden comment at the end of the file) only come along when asked for.
  async function saveCopy(withNotes) {
    if (!needT()) return;
    const text = withNotes ? withNotesText(T.editor.getMarkdown(), T.notes) : serializeFrom(T.editor.getMarkdown());
    const tag = withNotes ? " with notes" : " without notes";
    if (native) {
      const p = await native.saveDialog(ensureExt(T.name));
      if (p) {
        const r = await native.writeFile(p, text);
        message(r.ok ? "Saved a copy to " + baseName(p) + tag : "Could not save: " + r.error, r.ok ? "saved" : "err");
      }
    } else {
      download(ensureExt(T.name), text, "text/markdown");
      message("Downloaded a copy" + tag);
    }
  }
  function reveal() {
    if (native && T.fileRef && T.fileRef.path) native.showInFolder(T.fileRef.path);
    else message(native ? "This document hasn’t been saved to a file yet." : "Available in the Mac app.", "err");
  }
  const inPlainField = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.activeElement.closest(".ProseMirror");
  const ACT = {
    new: () => newTab(),
    open: openFile,
    recent: showRecent,
    reveal,
    save: () => saveFile(false),
    saveas: () => saveFile(true),
    snapshot: () => snapshot("Manual", true).then((ok) => message(ok ? "Version saved" : "Nothing to save yet")),
    copymd: () =>
      navigator.clipboard.writeText(getDoc()).then(() => {
        message("Copied as Markdown — paste into Claude, ChatGPT or GitHub");
        if (isScratch(T)) flashBtn($("btnCopyScratch"));
      }),
    copyrich: copyRich,
    downloadmd: () => saveCopy(false),
    downloadmdnotes: () => saveCopy(true),
    exporthtml: async () => {
      const n = T.name.replace(/\.[^.]+$/, "") + ".html";
      if (native) {
        const p = await native.saveDialog(n, "html");
        if (p) {
          const r = await native.writeFile(p, exportHtml());
          message(r.ok ? "Exported " + baseName(p) : "Export failed: " + r.error, r.ok ? "saved" : "err");
        }
      } else download(n, exportHtml(), "text/html");
    },
    print: printDoc,
    find: () => openFind(),
    prefs: () => openPrefs(),
    help: () => $("mHelp").classList.toggle("on"),
    note: addNote,
    revprompt: copyRevisionPrompt,
    margin: () => setMarginNotes(!prefs.marginNotes),
    indent: () => indent(),
    outdent: () => outdent(),
    scratch: () => scratchFromClipboard(),
    copyscratch: () => ACT.copymd(),
    bold: () => T.editor.exec("bold"),
    italic: () => T.editor.exec("italic"),
    strike: () => T.editor.exec("strike"),
    code: () => T.editor.exec("code"),
    h0: () => setHeading(0),
    h1: () => setHeading(1),
    h2: () => setHeading(2),
    h3: () => setHeading(3),
    h4: () => setHeading(4),
    bulletList: () => T.editor.exec("bulletList"),
    orderedList: () => T.editor.exec("orderedList"),
    taskList: () => runCmd("taskList"),
    blockQuote: () => T.editor.exec("blockQuote"),
    codeBlock: () => T.editor.exec("codeBlock"),
    hr: () => T.editor.exec("hr"),
    link: () => $("btnLink").click(),
    table: () => $("btnTable").click(),
    modeWrite: () => setMode("wysiwyg"),
    modeMarkdown: () => setMode("markdown"),
    sidebar: () => setSide(!prefs.side),
    preview: () => setMdPreview(!prefs.mdPreview),
    bigger: () => setSize(prefs.size + 1),
    smaller: () => setSize(prefs.size - 1),
    zoomReset: () => setSize(BASE_SIZE),
    resetLayout: () => resetLayout(),
    focus: () => setFocus(!document.body.classList.contains("focus")),
    whatsnew: () => showChangelog(),
    widthNormal: () => setWidth("normal"),
    widthWide: () => setWidth("wide"),
    widthFull: () => setWidth("full"),
    undo: () => {
      if (inPlainField()) document.execCommand("undo");
      else if (!undoNoteOp(false)) T.editor.exec("undo");
    },
    redo: () => {
      if (inPlainField()) document.execCommand("redo");
      else if (!undoNoteOp(true)) T.editor.exec("redo");
    },
    closeTab: () => closeTab(T),
    nextTab: () => cycleTab(1),
    prevTab: () => cycleTab(-1),
    home: () => toggleHome(),
    import: () => openFile(),
  };
  $("fileMenu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    closeMenus();
    if (ACT[b.dataset.act]) ACT[b.dataset.act]();
  });

  // Drag & drop files
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth++;
    $("drop").classList.add("on");
  });
  window.addEventListener("dragleave", () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      $("drop").classList.remove("on");
    }
  });
  window.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  window.addEventListener(
    "drop",
    async (e) => {
      const files = Array.from(e.dataTransfer.files || []);
      dragDepth = 0;
      $("drop").classList.remove("on");
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      for (const f of files) {
        let ref = null;
        const item = e.dataTransfer.items && e.dataTransfer.items[files.indexOf(f)];
        if (native) {
          const p = native.pathFor(f);
          if (p) ref = { path: p };
        } else if (item && item.getAsFileSystemHandle) {
          try {
            const hh = await item.getAsFileSystemHandle();
            if (hh && hh.kind === "file") ref = { handle: hh };
          } catch (err) {}
        }
        if (ref && ref.path) await openFromRef(ref);
        else await openBlob(f, ref);
      }
    },
    true,
  );
  window.addEventListener("beforeunload", (e) => {
    if (!native && tabs.some((t) => t.dirty && !(prefs.autosave && t.fileRef))) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // =====================================================================
  // Indent: nest a list item, or pull a paragraph that ended up stranded inside a bullet back out to the margin
  // =====================================================================
  function inListItem(view) {
    const $f = view.state.selection.$from;
    for (let d = $f.depth; d > 0; d--) if ($f.node(d).type.name === "listItem") return { depth: d, index: $f.index(d) };
    return null;
  }
  function outdent() {
    if (!T || homeShown) return;
    if (isWW()) {
      const li = inListItem(T.wwView);
      if (li && li.index > 0) {
        const v = T.wwView;
        if (window.PM.lift(v.state, v.dispatch)) {
          T.editor.focus();
          return;
        }
      }
    }
    T.editor.exec("outdent");
    T.editor.focus();
  }
  function indent() {
    if (!T || homeShown) return;
    if (isWW()) {
      const v = T.wwView,
        st = v.state,
        $f = st.selection.$from;
      if (!inListItem(v) && $f.depth === 1 && $f.parent.type.name === "paragraph" && $f.index(0) > 0 && /List$/.test(st.doc.child($f.index(0) - 1).type.name)) {
        // a plain paragraph straight after a list joins the list's last item as a continuation
        const start = $f.before(1),
          node = $f.parent;
        v.dispatch(
          st.tr
            .delete(start, start + node.nodeSize)
            .insert(start - 2, node)
            .scrollIntoView(),
        );
        T.editor.focus();
        return;
      }
    }
    T.editor.exec("indent");
    T.editor.focus();
  }
  $("btnOutdent").addEventListener("click", outdent);
  $("btnIndent").addEventListener("click", indent);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Tab" || e.metaKey || e.ctrlKey || e.altKey || !T || homeShown || !isWW() || !wwPM().contains(e.target)) return;
      const li = inListItem(T.wwView);
      if (!li || li.index === 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) outdent();
    },
    true,
  );

  // =====================================================================
  // Toolbar: commands, headings, link, table, overflow menu
  // =====================================================================
  function runCmd(cmd) {
    if (cmd === "taskList" && isWW()) {
      const $from = T.wwView.state.selection.$from;
      let inList = false;
      for (let d = $from.depth; d > 0; d--)
        if ($from.node(d).type.name === "listItem") {
          inList = true;
          break;
        }
      if (!inList) T.editor.exec("bulletList");
    }
    T.editor.exec(cmd);
  }
  document.querySelectorAll("[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => {
      runCmd(b.dataset.cmd);
      T.editor.focus();
    }),
  );
  $("headingMenu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-h]");
    if (!b) return;
    closeMenus();
    setHeading(+b.dataset.h);
  });
  function setHeading(level) {
    if (level === 0) {
      if (isWW()) {
        const { state, dispatch } = T.wwView;
        dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, state.schema.nodes.paragraph));
      } else {
        const s = T.editor.getSelection();
        const line = s[0][0];
        const t = T.editor.getMarkdown().split("\n")[line - 1] || "";
        const nt = t.replace(/^ {0,3}#{1,6}\s+/, "");
        if (nt !== t) T.editor.replaceSelection(nt, [line, 1], [line, t.length + 1]);
      }
    } else T.editor.exec("heading", { level });
    T.editor.focus();
  }
  $("btnLink").addEventListener("click", () => {
    $("linkText").value = selectedText();
    $("linkUrl").value = "";
    openModal("mLink");
  });
  $("linkOk").addEventListener("click", () => {
    const url = $("linkUrl").value.trim();
    if (!url) {
      $("linkUrl").focus();
      return;
    }
    T.editor.exec("addLink", { linkUrl: url, linkText: $("linkText").value.trim() || url });
    hideModal($("mLink"));
    T.editor.focus();
  });
  $("linkUrl").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("linkOk").click();
  });
  $("btnTable").addEventListener("click", () => openModal("mTable"));
  $("tblOk").addEventListener("click", () => {
    const c = Math.max(1, Math.min(12, +$("tblCols").value || 3)),
      r = Math.max(2, Math.min(50, +$("tblRows").value || 3));
    T.editor.exec("addTable", { columnCount: c, rowCount: r });
    hideModal($("mTable"));
    T.editor.focus();
  });

  // Responsive toolbar: fold lower-priority tools into "⋯" as the window narrows
  const topbar = $("topbar");
  let fitting = false;
  function fitToolbar() {
    if (fitting) return;
    fitting = true;
    requestAnimationFrame(() => {
      topbar.classList.remove("c1", "c2", "c3");
      $("moreWrap").hidden = true;
      let level = 0;
      while (topbar.scrollWidth > topbar.clientWidth + 1 && level < 3) {
        level++;
        topbar.classList.add("c" + level);
        $("moreWrap").hidden = false;
      }
      if (level) buildMoreMenu(level);
      fitting = false;
    });
  }
  function buildMoreMenu(level) {
    const m = $("moreMenu");
    m.innerHTML = "";
    document.querySelectorAll("#topbar .tb-btn[data-pri]").forEach((b) => {
      if (+b.dataset.pri > level) return;
      const item = document.createElement("button");
      item.textContent = b.dataset.label || b.title.replace(/\s*\(.*\)$/, "");
      const k = (b.title.match(/\(([^)]+)\)$/) || [])[1];
      if (k) item.innerHTML += '<span class="k">' + escapeHtml(k) + "</span>";
      item.addEventListener("click", () => {
        closeMenus();
        b.click();
      });
      m.appendChild(item);
    });
    if (level >= 2) {
      const item = document.createElement("button");
      item.innerHTML = 'Add note <span class="k">⇧⌘M</span>';
      item.addEventListener("click", () => {
        closeMenus();
        addNote();
      });
      m.prepend(item);
    }
  }
  new ResizeObserver(fitToolbar).observe(topbar);

  // =====================================================================
  // Find & replace
  // =====================================================================
  let findFrom = 0;
  let findHL = null;
  function setFindHL(range) {
    try {
      if (window.CSS && CSS.highlights && window.Highlight) {
        if (range) CSS.highlights.set("edith-find", new Highlight(range));
        else CSS.highlights.delete("edith-find");
      }
    } catch (e) {}
  }
  // Selecting a match moves focus into the document; hand it straight back to the find box so typing and Enter keep going there.
  function keepFindFocus(fn) {
    const ae = document.activeElement,
      inBar = ae && ae.closest && ae.closest(".findbar") && ae.tagName === "INPUT";
    const a = inBar ? ae.selectionStart : 0,
      b = inBar ? ae.selectionEnd : 0;
    const out = fn();
    if (inBar) {
      let r = null;
      try {
        const sel = window.getSelection();
        if (sel.rangeCount && !sel.isCollapsed) r = sel.getRangeAt(0).cloneRange();
      } catch (e) {}
      setFindHL(r);
      ae.focus();
      try {
        ae.setSelectionRange(a, b);
      } catch (e) {}
    }
    return out;
  }
  function openFind() {
    if (!T || homeShown) return;
    $("findbar").classList.add("on");
    const q = selectedText();
    if (q && !q.includes("\n")) $("findQ").value = q;
    $("findQ").focus();
    $("findQ").select();
    findFrom = 0;
    doFind(true);
  }
  function closeFind(refocus) {
    $("findbar").classList.remove("on");
    $("findCnt").textContent = "";
    setFindHL(null);
    if (refocus !== false && T && !homeShown) {
      const root = viewRoot(),
        st = root ? root.scrollTop : 0;
      T.editor.focus();
      if (root) root.scrollTop = st;
    }
  }
  function doFind(stay) {
    const q = $("findQ").value;
    if (!q) {
      $("findCnt").textContent = "";
      return;
    }
    const r = keepFindFocus(() => selectMatch(q, stay ? Math.max(0, findFrom - 1) : findFrom));
    if (!r) {
      setFindHL(null);
      $("findCnt").textContent = "No matches";
      return;
    }
    findFrom = r.next;
    $("findCnt").textContent = r.total + (r.total === 1 ? " match" : " matches");
  }
  function findPrev() {
    const q = $("findQ").value;
    if (!q) return;
    const probe = isWW() ? findInWW(q, 0) : findInMD(q, 0);
    if (!probe) return;
    const all = probe.all();
    const cur = Math.max(0, findFrom - 1);
    const prev = all.filter((x) => x < cur).pop();
    const r = keepFindFocus(() => selectMatch(q, prev === undefined ? all[all.length - 1] : prev));
    if (r) findFrom = r.next;
  }
  async function replaceOne() {
    const q = $("findQ").value;
    if (!q) return;
    const rv = $("findR").value,
      tab = T;
    const cur = selectMatch(q, Math.max(0, findFrom - 1)); // select the current match in the document, then swap it
    if (cur) {
      await new Promise((r) => setTimeout(r, 40));
      if (T !== tab) return;
      T.editor.replaceSelection(rv);
      findFrom = cur.offset + rv.length;
    }
    keepFindFocus(() => {});
    doFind(true);
    if (!cur) return;
    $("findR").focus();
  }
  function replaceAll() {
    // one ProseMirror transaction, so a single undo reverts every replacement
    const q = $("findQ").value;
    if (!q) return;
    const r = $("findR").value;
    const view = isWW() ? T.wwView : T.mdView;
    const lq = q.toLowerCase();
    const hits = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      const t = node.text.toLowerCase();
      let k = -1;
      while ((k = t.indexOf(lq, k + 1)) >= 0) {
        hits.push([pos + k, pos + k + q.length, node.marks]);
        k += q.length - 1;
      }
    });
    if (!hits.length) {
      $("findCnt").textContent = "No matches";
      return;
    }
    let tr = view.state.tr;
    hits.reverse().forEach(([a, b, marks]) => {
      tr = r ? tr.replaceWith(a, b, view.state.schema.text(r, marks)) : tr.delete(a, b);
    });
    view.dispatch(tr);
    onChange();
    $("findCnt").textContent = "Replaced " + hits.length;
  }
  $("btnFind").addEventListener("click", () => {
    if ($("findbar").classList.contains("on")) closeFind();
    else openFind();
  });
  $("findClose").addEventListener("click", () => closeFind());
  $("findNext").addEventListener("click", () => doFind(false));
  $("findPrev").addEventListener("click", findPrev);
  $("replOne").addEventListener("click", replaceOne);
  $("replAll").addEventListener("click", replaceAll);
  $("findQ").addEventListener("input", () => {
    findFrom = 0;
    doFind(true);
  });
  $("findQ").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? findPrev() : doFind(false);
    }
  });
  $("findR").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      replaceOne();
    }
  });

  // =====================================================================
  // Layout: modes, sidebar, resizers, themes, preferences
  // =====================================================================
  function applyModeUI() {
    const m = T.editor.isMarkdownMode() ? "markdown" : "wysiwyg";
    document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    $("btnPreview").hidden = m !== "markdown";
  }
  function setMode(m) {
    const a = captureAnchor(),
      el = T.el,
      swap = T.editor.isMarkdownMode() !== (m === "markdown"),
      // the Markdown editor's own text is free to read; asking Write mode for it converts the whole document again
      md = T.editor.isMarkdownMode() ? T.editor.getMarkdown() : undefined;
    // Hide the editor while it re-lays itself out, so the reader never sees it at the wrong scroll position or half-rendered.
    if (swap) {
      el.classList.remove("mode-swap-in");
      el.classList.add("mode-swap");
      T.editor.changeMode(m, true);
      T.modeBase = histDepth(T, "undoDepth");
    }
    prefs.mode = m;
    savePrefs();
    applyModeUI();
    buildOutline(md);
    setTimeout(() => {
      ensureMdGutter();
      applySpell();
    }, 0);
    saveSession();
    if (swap) holdPreviewOnTop(700);
    settleAnchor(a);
    layoutMargin();
    if (swap) {
      applyAnchor(a);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          applyAnchor(a);
          if (!isWW() && T.editor.scrollSync) T.editor.scrollSync.syncPreviewScrollTop();
          el.classList.add("mode-swap-in");
          el.classList.remove("mode-swap");
          setTimeout(() => el.classList.remove("mode-swap-in"), 200);
        }),
      );
    }
  }
  // Toast UI re-syncs the Markdown preview to the caret ~200 ms after each preview render. That fights the reading position we just restored, so the preview bounces. For a short window after a switch, sync it to the top of the view instead.
  function holdPreviewOnTop(ms) {
    const ss = T.editor.scrollSync;
    if (!ss || typeof ss.syncPreviewScrollTop !== "function" || ss.syncPreviewScrollTop.held) return;
    const orig = ss.syncPreviewScrollTop;
    const top = function () {
      return orig.call(this, false);
    };
    top.held = true;
    ss.syncPreviewScrollTop = top;
    setTimeout(() => {
      if (ss.syncPreviewScrollTop === top) delete ss.syncPreviewScrollTop;
      if (ss.clearTimer) ss.clearTimer();
    }, ms);
  }
  // A real switch already focuses the editor (changeMode(m, true)). Clicking the mode you are in only refocuses, and focus() scrolls to the caret, so keep the reading place around it.
  function switchMode(m) {
    const was = T.editor.isMarkdownMode();
    setMode(m);
    if (was === (m === "markdown")) keepPosition(() => T.editor.focus());
  }
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => switchMode(b.dataset.mode)));
  function setMdPreview(on) {
    prefs.mdPreview = on;
    savePrefs();
    keepPosition(() => work.classList.toggle("md-nopreview", !on));
    $("btnPreview").classList.toggle("active", on);
  }
  $("btnPreview").addEventListener("click", () => setMdPreview(!prefs.mdPreview));
  function setSide(on) {
    prefs.side = on;
    savePrefs();
    keepPosition(() => work.classList.toggle("no-side", !on));
    $("btnSide").classList.toggle("active", on);
  }
  $("btnSide").addEventListener("click", () => setSide(!prefs.side));
  function setTab(t) {
    prefs.tab = t;
    savePrefs();
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + t));
    if (!prefs.side) setSide(true);
  }
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  function dragger(el, onMove, onReset) {
    el.addEventListener("mousedown", (e) => {
      if (e.detail === 2) {
        onReset();
        return;
      }
      e.preventDefault();
      el.classList.add("drag");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const mv = (ev) => onMove(ev.clientX);
      const up = () => {
        el.classList.remove("drag");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", mv);
        window.removeEventListener("mouseup", up);
        savePrefs();
      };
      window.addEventListener("mousemove", mv);
      window.addEventListener("mouseup", up);
    });
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      onReset();
    });
  }
  const applySideW = () => document.documentElement.style.setProperty("--side", prefs.sideW + "px");
  const applyMdSplit = () => document.documentElement.style.setProperty("--mdsplit", prefs.mdsplit + "%");
  dragger(
    $("sideGutter"),
    (x) => {
      prefs.sideW = Math.max(160, Math.min(520, x));
      applySideW();
    },
    () => {
      prefs.sideW = DEFAULTS.sideW;
      savePrefs();
      applySideW();
    },
  );
  function ensureMdGutter(tab) {
    tab = tab || T;
    const c = tab.el.querySelector(".toastui-editor-md-container");
    if (!c || c.querySelector(".md-gutter")) return;
    const g = document.createElement("div");
    g.className = "md-gutter";
    g.title = "Drag to resize · double-click to reset";
    c.appendChild(g);
    dragger(
      g,
      (x) => {
        const r = c.getBoundingClientRect();
        prefs.mdsplit = Math.max(20, Math.min(80, ((x - r.left) / r.width) * 100));
        applyMdSplit();
      },
      () => {
        prefs.mdsplit = DEFAULTS.mdsplit;
        savePrefs();
        applyMdSplit();
      },
    );
  }
  function resetLayout() {
    prefs.sideW = DEFAULTS.sideW;
    prefs.mdsplit = DEFAULTS.mdsplit;
    savePrefs();
    applySideW();
    applyMdSplit();
    setSize(BASE_SIZE);
    setSide(true);
    setWidth("normal");
    message("Layout reset");
  }
  function applyTheme() {
    document.documentElement.dataset.theme = prefs.theme;
    renderThemeMenu();
    if (native) native.setTheme(prefs.theme);
  }
  function renderThemeMenu() {
    const m = $("themeMenu");
    m.innerHTML = "";
    THEMES.forEach((t) => {
      const b = document.createElement("button");
      b.className = "theme" + (t.id === prefs.theme ? " on" : "");
      b.innerHTML =
        '<span class="theme-prev" style="background:' +
        t.bg +
        ";--p-accent:" +
        t.accent +
        ";--p-ink:" +
        t.ink +
        '"></span><span>' +
        t.name +
        '</span><span class="sub">' +
        t.sub +
        "</span>";
      b.addEventListener("click", () => {
        prefs.theme = t.id;
        savePrefs();
        applyTheme();
      });
      m.appendChild(b);
    });
  }
  function applySpell() {
    document.querySelectorAll(".editor-host .ProseMirror").forEach((el) => el.setAttribute("spellcheck", prefs.spell ? "true" : "false"));
  }
  async function openPrefs() {
    $("pAutosave").checked = prefs.autosave;
    $("pDelay").value = prefs.autosaveDelay;
    $("pDelayOut").textContent = prefs.autosaveDelay;
    $("pVer").value = prefs.verMinutes;
    $("pVerOut").textContent = prefs.verMinutes;
    $("pVerMax").value = prefs.verMax;
    $("pVerMaxOut").textContent = prefs.verMax;
    $("pCap").value = prefs.capMB;
    $("pCapOut").textContent = prefs.capMB;
    $("pSpell").checked = prefs.spell;
    $("pMode").value = prefs.mode;
    $("pSize").value = prefs.size;
    $("pSizeOut").textContent = $("btnZoom").textContent;
    const ts = $("pTheme");
    ts.innerHTML = "";
    THEMES.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name + " — " + t.sub;
      ts.appendChild(o);
    });
    ts.value = prefs.theme;
    const st = $("pStorage"),
      acts = $("pStorageActions");
    acts.innerHTML = "";
    if (native) {
      const paths = native.paths();
      st.innerHTML =
        "Your documents stay wherever you saved them; autosave writes into that same file. Settings, version history, the recent-files list and recovery drafts live in <code>" +
        escapeHtml(paths.userData) +
        "</code>. Notes you attach to text are kept by Edith in that folder (with plain-text backups in <code>notes-backup</code>), never inside your .md files.";
      const b = document.createElement("button");
      b.className = "tb-btn";
      b.textContent = "Show in Finder";
      b.addEventListener("click", () => native.showInFolder(paths.userData));
      acts.appendChild(b);
    } else
      st.textContent =
        "Settings, version history and recovery drafts are stored in this browser profile. Notes you attach to text are kept by Edith in this browser profile, never inside your .md files.";
    openModal("mPrefs");
    refreshUsage();
  }
  async function refreshUsage() {
    try {
      const all = await allVersions();
      const bytes = all.reduce((s, v) => s + v.size, 0);
      const files = new Set(all.map((v) => v.file)).size;
      $("pUsage").textContent =
        "Currently using " +
        fmtSize(bytes) +
        " across " +
        all.length +
        " versions of " +
        files +
        " file" +
        (files === 1 ? "" : "s") +
        ". When the limit is reached, the oldest automatic versions are removed first.";
    } catch (e) {}
  }
  $("btnPrefs").addEventListener("click", openPrefs);
  $("pAutosave").addEventListener("change", () => setAutosave($("pAutosave").checked));
  $("pDelay").addEventListener("input", () => {
    prefs.autosaveDelay = +$("pDelay").value;
    $("pDelayOut").textContent = prefs.autosaveDelay;
    savePrefs();
    updateAutosaveTip();
  });
  $("pVer").addEventListener("input", () => {
    prefs.verMinutes = +$("pVer").value;
    $("pVerOut").textContent = prefs.verMinutes;
    savePrefs();
  });
  $("pVerMax").addEventListener("input", () => {
    prefs.verMax = +$("pVerMax").value;
    $("pVerMaxOut").textContent = prefs.verMax;
    savePrefs();
  });
  $("pVerMax").addEventListener("change", () =>
    enforceCaps().then(() => {
      refreshUsage();
      renderHistory();
    }),
  );
  $("pCap").addEventListener("input", () => {
    prefs.capMB = +$("pCap").value;
    $("pCapOut").textContent = prefs.capMB;
    savePrefs();
  });
  $("pCap").addEventListener("change", () =>
    enforceCaps().then(() => {
      refreshUsage();
      renderHistory();
    }),
  );
  $("pClearHistory").addEventListener("click", async () => {
    if (
      !(await confirmBox(
        "Delete all version history?",
        "Every saved version of every file will be removed. Your documents themselves are not touched.",
        "Delete all",
      ))
    )
      return;
    {
      const d = await db();
      await new Promise((res) => {
        const tx = d.transaction(["versions", "meta"], "readwrite");
        tx.objectStore("versions").clear();
        tx.objectStore("meta").clear();
        tx.oncomplete = res;
        tx.onerror = res;
      });
    }
    refreshUsage();
    renderHistory();
    message("Version history cleared");
  });
  $("pSpell").addEventListener("change", () => {
    prefs.spell = $("pSpell").checked;
    savePrefs();
    applySpell();
  });
  $("pMode").addEventListener("change", () => setMode($("pMode").value));
  $("pTheme").addEventListener("change", () => {
    prefs.theme = $("pTheme").value;
    savePrefs();
    applyTheme();
  });
  $("pSize").addEventListener("input", () => setSize(+$("pSize").value));
  $("pResetLayout").addEventListener("click", resetLayout);
  $("btnHelp").addEventListener("click", () => openModal("mHelp"));
  $("helpNote").textContent = native
    ? "Save writes straight to the file. Autosave and all other settings are in Preferences (⌘,)."
    : hasFSA
      ? "Save writes directly back to the file you opened; Autosave (bottom right) does it as you type."
      : "This browser can’t write files in place, so Save downloads a copy. For save-in-place and autosave, use the Mac app or Chrome.";
  fnameEl.addEventListener("change", async () => {
    const n = fnameEl.value.trim() || "untitled.md";
    if (n === T.name) return;
    const oldKey = keyOf(T);
    T.name = n;
    T.fileRef = null;
    await rekeyVersions(oldKey, keyOf(T));
    onChange();
    renderTabs();
    renderHistory();
    updateAutosaveTip();
    message("Renamed — Save to write it under the new name", "");
  });
  fnameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      fnameEl.blur();
      T.editor.focus();
    }
  });
  $("renameOk").addEventListener("click", () => {
    const n = $("renameInput").value.trim();
    hideModal($("mRename"));
    if (!n || !T || n === T.name) return;
    fnameEl.value = n;
    fnameEl.dispatchEvent(new Event("change"));
  });
  $("renameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("renameOk").click();
  });

  // =====================================================================
  // Keyboard shortcuts (capture phase so they win over the editor's own)
  // =====================================================================
  if (!native)
    document.addEventListener(
      "keydown",
      (e) => {
        if (
          !(e.metaKey || e.ctrlKey) ||
          e.altKey ||
          e.key.toLowerCase() !== "z" ||
          (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.activeElement.closest(".ProseMirror"))
        )
          return;
        if (undoNoteOp(e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
  document.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        if ($("findbar").classList.contains("on") && document.activeElement.closest(".findbar")) {
          closeFind();
          return;
        }
        if (document.body.classList.contains("focus") && !document.querySelector(".modal.on")) {
          setFocus(false);
          return;
        }
        closeModals();
        hideBubble();
        return;
      }
      if (!mod) return;
      const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.activeElement.closest(".ProseMirror");
      if (
        (!T || homeShown) &&
        !["t", "n", "o", ",", "/", "\\", "q", "w", "h"].includes(k) &&
        !(e.shiftKey && (e.code === "BracketRight" || e.code === "BracketLeft"))
      )
        return;
      let handled = true;
      if (k === "s" && !e.altKey) saveFile(e.shiftKey);
      else if (k === "s" && e.altKey) ACT.snapshot();
      else if (k === "o" && !e.shiftKey) openFile();
      else if (k === "o" && e.shiftKey) showRecent();
      else if (k === "t" && !e.shiftKey) newTab();
      else if (k === "n" && !e.shiftKey) newTab();
      else if (k === "n" && e.shiftKey) scratchFromClipboard();
      else if (k === "w" && !e.shiftKey) closeTab(T);
      else if (k === "p" && !e.shiftKey && !e.altKey) printDoc();
      else if (k === "f" && !e.shiftKey) openFind();
      else if (k === "/") $("mHelp").classList.toggle("on");
      else if (k === ",") openPrefs();
      else if (k === "\\") setSide(!prefs.side);
      else if ((k === "=" || k === "+") && !e.altKey) setSize(prefs.size + 1);
      else if (k === "-" && !inField && !e.altKey) setSize(prefs.size - 1);
      else if (k === "0" && !e.altKey && !e.shiftKey) setSize(BASE_SIZE);
      else if (e.altKey && /^[0-4]$/.test(k) && !inField) setHeading(+k);
      else if (e.altKey && (e.code === "Digit0" || e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3" || e.code === "Digit4") && !inField)
        setHeading(+e.code.slice(-1));
      else if (e.shiftKey && k === "m") addNote();
      else if (e.shiftKey && k === "r" && !e.altKey) copyRevisionPrompt();
      else if (e.shiftKey && k === "f") setFocus(!document.body.classList.contains("focus"));
      else if (e.shiftKey && k === "h") toggleHome();
      else if (e.shiftKey && (e.code === "BracketRight" || e.code === "BracketLeft")) cycleTab(e.code === "BracketRight" ? 1 : -1);
      else if (!inField && !e.shiftKey && !e.altKey && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        if (e.code === "BracketRight") indent();
        else outdent();
      } else if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit2")) switchMode(e.code === "Digit1" ? "wysiwyg" : "markdown");
      else if (!inField && e.shiftKey && e.code === "Digit8") T.editor.exec("bulletList");
      else if (!inField && e.shiftKey && e.code === "Digit7") T.editor.exec("orderedList");
      else if (!inField && e.shiftKey && e.code === "Digit9") runCmd("taskList");
      else if (!inField && e.shiftKey && k === "x") T.editor.exec("strike");
      else if (!inField && !e.shiftKey && k === "e") T.editor.exec("code");
      else if (!inField && !e.shiftKey && k === "k") $("btnLink").click();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // =====================================================================
  // Startup
  // =====================================================================
  {
    let lastWarn = 0;
    window.__edithWarn = () => {
      if (Date.now() - lastWarn < 60000) return;
      lastWarn = Date.now();
      message("Could not keep a recovery copy: this document is too large. Save it to a file to be safe.", "err");
    };
  }
  applyTheme();
  applySideW();
  applyMdSplit();
  setSize(prefs.size);
  setWidth(prefs.width);
  setSide(prefs.side);
  setTab(prefs.tab);
  setMdPreview(prefs.mdPreview);
  setAutosave(prefs.autosave);
  if (native) {
    native.onMenu((action, arg) => {
      if (action === "theme") {
        prefs.theme = arg;
        savePrefs();
        applyTheme();
      } else if (action === "say") message(arg);
      else if (ACT[action]) ACT[action]();
    });
    native.onOpenPath((p) => openPath(p));
    native.onCloseRequest(async () => {
      for (const tab of tabs.slice()) {
        if (!tab.dirty || isScratch(tab)) continue;
        if (prefs.autosave && tab.fileRef && tab.fileRef.path) {
          if (T !== tab) await activateTab(tab);
          await saveFile(false, true);
          if (!tab.dirty) continue;
        }
        if (T !== tab) await activateTab(tab);
        const choice = await native.askClose(tab.name);
        if (choice === 1) return;
        if (choice === 0) {
          await saveFile(false);
          if (tab.dirty) return;
        }
        if (choice === 2) tab.discarded = true;
      }
      clearTimeout(sessionTimer);
      await Promise.all(tabs.map((t) => persistNotes(t)));
      const keep = tabs.filter((tab) => !tab.discarded || tab.fileRef);
      store(SESSION_KEY, {
        active: Math.max(0, keep.indexOf(T)),
        tabs: keep.map((tab) => ({
          name: tab.name,
          path: (tab.fileRef && tab.fileRef.path) || null,
          dirty: false,
          notes: tab.notes,
          trash: tab.trash || [],
          text: tab.fileRef ? null : serializeTab(tab),
          mode: tab.editor.isMarkdownMode() ? "markdown" : "wysiwyg",
          scratch: !!tab.scratch,
        })),
      });
      native.closeConfirmed();
    });
  }
  const WELCOME = [
    "# Welcome to Edith",
    "",
    "Write here like you would in any document — headings, bold, lists — and Edith stores it as clean Markdown underneath. Switch to **Markdown** at the top right any time to see or edit the raw text.",
    "",
    "## Getting started",
    "",
    "- Open a file with **⌘O**, or drop one onto the window",
    "- Paste from Claude or ChatGPT and the Markdown is rendered as formatting",
    "- Save with **⌘S**. With Autosave on, changes are written into that file as you type",
    "- Open a Word document or PDF and it is converted to Markdown on your Mac",
    "",
    "## Typing shortcuts",
    "",
    "At the start of a line, type `#` and a space for a title, `##` for a heading, `-` for a bullet, `1.` for a numbered list, `[ ]` for a checkbox, `>` for a quote, or `---` for a divider.",
    "",
    "## Notes and versions",
    "",
    "Select some text and press **⇧⌘M** (or click the Add note button that appears) to leave a comment on it. Open **History** in the sidebar to compare, copy from, or restore earlier versions.",
    "",
    "| Shortcut | Action |",
    "| --- | --- |",
    "| ⌘B / ⌘I | Bold / Italic |",
    "| ⌥⌘1 / ⌥⌘2 / ⌥⌘3 | Title / Heading / Subheading |",
    "| ⌘T / ⌘W | New tab / Close tab |",
    "| ⌘F | Find and replace |",
    "| ⌘/ | All shortcuts |",
    "",
  ].join("\n");

  async function restoreSession() {
    const s = load(SESSION_KEY);
    const legacy = load(LEGACY_DRAFT);
    const items = s && Array.isArray(s.tabs) && s.tabs.length ? s.tabs : [];
    if (!items.length && legacy && legacy.text && legacy.dirty) items.push({ name: legacy.name || "untitled.md", path: null, dirty: true, text: legacy.text });
    let restored = 0,
      firstTab = null;
    for (const it of items) {
      const tab = createTab({ mode: it.mode || prefs.mode });
      if (it.scratch) tab.scratch = true;
      let text = it.text,
        ok = true;
      if (it.path && native) {
        const r = await native.readFile(it.path);
        if (r.ok) {
          if (!it.dirty || text == null) text = new TextDecoder().decode(r.bytes);
          tab.fileRef = { path: it.path };
          tab.fileMtime = r.mtime || null;
        } else if (text == null) ok = false;
      } else if (it.path && !native) {
        ok = text != null;
      }
      if (!ok) {
        tab.el.remove();
        tabs.splice(tabs.indexOf(tab), 1);
        try {
          tab.editor.destroy();
        } catch (e) {}
        continue;
      }
      loadIntoTab(tab, text || "", it.name || baseName(it.path) || "untitled.md", { keepRef: true });
      if (Array.isArray(it.notes)) {
        tab.notes = it.notes;
        tab.trash = it.trash || [];
      } else if (tab.fileRef) await adoptNotes(tab, true);
      if (it.dirty) {
        tab.lastSavedText = "";
        tab.dirty = true;
      } else {
        tab.lastSavedText = serializeTab(tab);
        tab.dirty = false;
      }
      if (!firstTab) firstTab = tab;
      restored++;
    }
    if (!restored && !prefs.seenVersion) {
      const tab = createTab();
      loadIntoTab(tab, WELCOME, "untitled.md");
      tab.lastSavedText = serializeTab(tab);
      tab.isWelcome = true;
      await activateTab(tab);
    } else if (!restored) showStart();
    else {
      const idx = s && typeof s.active === "number" && tabs[s.active] ? s.active : 0;
      await activateTab(tabs[idx]);
      if (s && s.home) await showStart();
      if (items.some((i) => i.dirty)) message("Restored unsaved work from your last session");
    }
    localStorage.removeItem(LEGACY_DRAFT);
    if (prefs.seenVersion && prefs.seenVersion !== APP_VERSION)
      setTimeout(() => message("Updated to Edith " + APP_VERSION + " — see What’s new in the File menu"), 1200);
    prefs.seenVersion = APP_VERSION;
    savePrefs();
  }
  function showChangelog() {
    $("changelogBody").innerHTML = markdownToHtml(window.EDITH_CHANGELOG || "");
    $("changelogBody")
      .querySelectorAll("h2")
      .forEach((h) => {
        h.style.fontSize = "14px";
        h.style.margin = "14px 0 6px";
      });
    openModal("mChangelog");
  }
  // Edith's main process only hands over files the user chose. Updating from 3.7.2 or earlier, it learns the files
  // already in use (open tabs, Open Recent, files with notes) once, before any document is shown.
  async function seedAllowedFiles() {
    if (!native || !native.seedAllowed) return;
    try {
      const s = load(SESSION_KEY);
      const list = (s && Array.isArray(s.tabs) ? s.tabs : []).map((t) => t.path);
      ((await idb("recent", "readonly", (st) => st.getAll())) || []).forEach((r) => list.push(r.path));
      ((await idb("notes", "readonly", (st) => st.getAllKeys())) || []).forEach((k) => list.push(k));
      await native.seedAllowed(list.filter((p) => typeof p === "string" && p.charAt(0) === "/"));
    } catch (e) {}
  }
  // A theme's fonts are bundled but only decoded on first use, so the first switch to a theme drew the page in a
  // fallback font and then reflowed it. Once the window is idle after startup, load every face, one per idle moment.
  function preloadFonts() {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50));
    const faces = [...document.fonts].filter((f) => f.status === "unloaded");
    const next = () => {
      const f = faces.shift();
      if (f)
        f.load()
          .catch(() => {})
          .then(() => idle(next));
    };
    idle(next);
  }
  seedAllowedFiles()
    .then(restoreSession)
    .then(() => {
      fitToolbar();
      pushRecentToMenu();
      setTimeout(preloadFonts, 1500);
    });
})();
