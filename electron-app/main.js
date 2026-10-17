const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, clipboard, screen, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

app.name = "Edith";
// tests point this at a throwaway folder so they never touch a real Edith data folder
if (process.env.EDITH_TEST_USER_DATA) app.setPath("userData", process.env.EDITH_TEST_USER_DATA);
let win = null;
let pendingOpen = [];
let closeConfirmed = false;
const boundsFile = () => path.join(app.getPath("userData"), "window.json");
function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
  } catch (e) {
    return {};
  }
}
function saveBounds() {
  if (!win) return;
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify(Object.assign(win.getBounds(), { fullscreen: win.isFullScreen() })));
  } catch (e) {}
}

const DARK_THEMES = new Set(["dusk", "organic", "focused", "matrix"]);
const INDEX_URL = pathToFileURL(path.join(__dirname, "index.html")).href;

// ---------- Links ----------
// Only web and mail links leave the app, in the default browser or mail app. Everything else
// (file:, javascript:, custom schemes) is ignored, so a link in a document cannot launch a local program.
const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);
function isSafeExternal(url) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch (e) {
    return false;
  }
}
function openExternalSafe(url) {
  if (!isSafeExternal(url)) return false;
  shell.openExternal(new URL(url).href);
  return true;
}

// ---------- File access ----------
// The page can only read and write files the user chose: through the open and save dialogs, drag and drop,
// Finder (Open With / double-click) and, from earlier launches, files opened that way (Open Recent, restored tabs).
// The list is kept here in the main process, in allowed-files.json, never taken from the page.
// Pasted images may be written into the "<file>-images" folder beside a chosen file; notes backups into notes-backup/.
const ALLOWED_MAX = 2000;
const allowedFile = () => path.join(app.getPath("userData"), "allowed-files.json");
let allowed = null; // Map path -> last used (insertion order = oldest first)
let allowedSeeded = false;
function loadAllowed() {
  if (allowed) return;
  allowed = new Map();
  try {
    const j = JSON.parse(fs.readFileSync(allowedFile(), "utf8"));
    (j.files || []).forEach((f) => {
      if (typeof f === "string" && path.isAbsolute(f)) allowed.set(path.resolve(f), 1);
    });
    allowedSeeded = !!j.seeded;
  } catch (e) {}
}
let allowedTimer = null;
function saveAllowed() {
  clearTimeout(allowedTimer);
  allowedTimer = setTimeout(() => {
    try {
      fs.writeFileSync(allowedFile(), JSON.stringify({ seeded: allowedSeeded, files: [...allowed.keys()] }));
    } catch (e) {}
  }, 200);
}
function grant(p) {
  if (typeof p !== "string" || !path.isAbsolute(p)) return;
  loadAllowed();
  const r = path.resolve(p);
  allowed.delete(r);
  allowed.set(r, 1);
  while (allowed.size > ALLOWED_MAX) allowed.delete(allowed.keys().next().value);
  saveAllowed();
}
const norm = (p) => (typeof p === "string" && path.isAbsolute(p) ? path.resolve(p) : null);
function canUseFile(p) {
  const r = norm(p);
  if (!r) return false;
  loadAllowed();
  return allowed.has(r);
}
// same rule as saveImage in app.js: "/a/report.md" -> "/a/report-images"
const imagesDirOf = (file) => file.replace(/\.[^/]+$/, "") + "-images";
function canWriteBinary(p) {
  const r = norm(p);
  if (!r) return false;
  const dir = path.dirname(r);
  if (dir === path.join(app.getPath("userData"), "notes-backup")) return /^[\w.-]+\.json$/.test(path.basename(r));
  if (!dir.endsWith("-images")) return false;
  loadAllowed();
  for (const f of allowed.keys()) if (imagesDirOf(f) === dir) return true;
  return false;
}
const DENIED = { ok: false, denied: true, error: "Edith can only open files you chose. Open it with File → Open." };

function createWindow() {
  const b = loadBounds();
  // a saved position on a monitor that is no longer connected would open the window off-screen
  const onScreen =
    typeof b.x === "number" &&
    typeof b.y === "number" &&
    screen
      .getAllDisplays()
      .some(
        (d) =>
          b.x + 100 > d.workArea.x && b.x < d.workArea.x + d.workArea.width - 100 && b.y >= d.workArea.y - 20 && b.y < d.workArea.y + d.workArea.height - 100,
      );
  if (!onScreen) {
    delete b.x;
    delete b.y;
  }
  win = new BrowserWindow({
    width: b.width || 1280,
    height: b.height || 860,
    x: b.x,
    y: b.y,
    minWidth: 640,
    minHeight: 440,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, spellcheck: true },
  });
  win.loadFile(path.join(__dirname, "index.html"));
  win.once("ready-to-show", () => {
    win.show();
    if (b.fullscreen) win.setFullScreen(true);
    flushPending();
  });
  let boundsTimer = null;
  const onBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(saveBounds, 300);
  };
  win.on("resize", onBounds);
  win.on("move", onBounds);
  win.on("close", (e) => {
    if (closeConfirmed) return;
    saveBounds();
    e.preventDefault();
    win.webContents.send("close-request");
  });
  win.on("closed", () => {
    win = null;
  });

  // Right-click menu: spelling suggestions, edit actions, and "Add note" on a selection
  win.webContents.on("context-menu", (e, params) => {
    const items = [];
    for (const s of params.dictionarySuggestions.slice(0, 5)) items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
    if (params.misspelledWord) {
      items.push({ label: "Add to Dictionary", click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
      items.push({ type: "separator" });
    }
    if (params.selectionText && params.selectionText.trim()) {
      items.push({ label: "Add Note on Selection", click: () => send("note") });
      items.push({ type: "separator" });
    }
    if (params.isEditable) items.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { type: "separator" }, { role: "selectAll" });
    else items.push({ role: "copy" });
    if (params.linkURL && isSafeExternal(params.linkURL))
      items.push({ type: "separator" }, { label: "Open Link in Browser", click: () => openExternalSafe(params.linkURL) });
    Menu.buildFromTemplate(items).popup({ window: win });
  });
  // Nothing ever replaces the app page: a page loaded in its place (even a local .html file) would get the
  // window.native file bridge. Web and mail links go to the default browser; anything else is dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => {
    e.preventDefault();
    if (e.url !== INDEX_URL) openExternalSafe(e.url);
  });
  win.webContents.on("will-frame-navigate", (e) => {
    if (!e.isMainFrame && !/^about:(blank|srcdoc)$/.test(e.url)) e.preventDefault();
  });
  win.webContents.on("will-redirect", (e) => {
    if (e.isMainFrame) e.preventDefault();
  });
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
}

function send(action, arg) {
  if (win) win.webContents.send("menu", action, arg);
}
function flushPending() {
  while (pendingOpen.length && win) win.webContents.send("open-path", pendingOpen.shift());
}

const THEMES = [
  ["edith", "Edith"],
  ["dusk", "Dusk"],
  ["natural", "Natural"],
  ["organic", "Organic"],
  ["academic", "Academic"],
  ["focused", "Focused"],
  ["matrix", "Matrix"],
];
let currentTheme = "edith";
let recentList = [];
function buildMenu() {
  const t = (label, action, accelerator, extra) => Object.assign({ label, accelerator, click: () => send(action) }, extra || {});
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { label: "Check for Updates…", click: () => checkForUpdates(true) },
        { type: "separator" },
        t("Preferences…", "prefs", "Cmd+,"),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        t("New Tab", "new", "Cmd+T"),
        t("New Scratch from Clipboard", "scratch", "Shift+Cmd+N"),
        t("Open…", "open", "Cmd+O"),
        {
          label: "Open Recent",
          submenu: recentList.length
            ? recentList.slice(0, 12).map((r) => ({
                label: r.label,
                click: () => {
                  if (win) win.webContents.send("open-path", r.path);
                },
              }))
            : [{ label: "No Recent Documents", enabled: false }],
        },
        t("Show in Finder", "reveal", "Alt+Cmd+R"),
        { type: "separator" },
        t("Save", "save", "Cmd+S"),
        t("Save As…", "saveas", "Shift+Cmd+S"),
        t("Save a Version Now", "snapshot", "Alt+Cmd+S"),
        { type: "separator" },
        {
          label: "Export",
          submenu: [
            t("Copy as Markdown", "copymd"),
            t("Copy as Formatted Text", "copyrich"),
            t("Copy Notes as Prompt", "revprompt", "Shift+Cmd+R"),
            { type: "separator" },
            t("Save a .md Copy (Text Only)…", "downloadmd"),
            t("Save a .md Copy with Notes…", "downloadmdnotes"),
            t("Export as HTML…", "exporthtml"),
            t("Print / Save as PDF…", "print", "Cmd+P"),
          ],
        },
        { type: "separator" },
        t("Close Tab", "closeTab", "Cmd+W"),
        { role: "close", label: "Close Window", accelerator: "Shift+Cmd+W" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        t("Undo", "undo", "Cmd+Z"),
        t("Redo", "redo", "Shift+Cmd+Z"),
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
        { type: "separator" },
        t("Find and Replace…", "find", "Cmd+F"),
        t("Add Note on Selection", "note", "Shift+Cmd+M"),
        { type: "separator" },
        { label: "Speech", submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] },
      ],
    },
    {
      label: "Format",
      submenu: [
        t("Bold", "bold", "Cmd+B"),
        t("Italic", "italic", "Cmd+I"),
        t("Strikethrough", "strike", "Shift+Cmd+X"),
        t("Inline Code", "code", "Cmd+E"),
        { type: "separator" },
        t("Normal Text", "h0", "Alt+Cmd+0"),
        t("Title", "h1", "Alt+Cmd+1"),
        t("Heading", "h2", "Alt+Cmd+2"),
        t("Subheading", "h3", "Alt+Cmd+3"),
        t("Minor Heading", "h4", "Alt+Cmd+4"),
        { type: "separator" },
        t("Bulleted List", "bulletList", "Shift+Cmd+8"),
        t("Numbered List", "orderedList", "Shift+Cmd+7"),
        t("Checklist", "taskList", "Shift+Cmd+9"),
        t("Quote", "blockQuote", "Shift+Cmd+."),
        t("Code Block", "codeBlock", "Alt+Cmd+C"),
        { type: "separator" },
        t("Increase Indent", "indent", "Cmd+]"),
        t("Decrease Indent", "outdent", "Cmd+["),
        { type: "separator" },
        t("Link…", "link", "Cmd+K"),
        t("Table…", "table", "Alt+Cmd+T"),
        t("Divider", "hr", "Alt+Cmd+-"),
      ],
    },
    {
      label: "View",
      submenu: [
        t("Write Mode", "modeWrite", "Shift+Cmd+1"),
        t("Markdown Mode", "modeMarkdown", "Shift+Cmd+2"),
        t("Show/Hide Preview (Markdown Mode)", "preview", "Alt+Cmd+P"),
        { type: "separator" },
        t("Home", "home", "Shift+Cmd+H"),
        t("Show/Hide Sidebar", "sidebar", "Cmd+\\"),
        t("Focus Mode", "focus", "Shift+Cmd+F"),
        t("Show Notes Beside the Page", "margin"),
        t("Reset Layout", "resetLayout"),
        { type: "separator" },
        { label: "Page Width", submenu: [t("Comfortable", "widthNormal"), t("Wide", "widthWide"), t("Full Window", "widthFull")] },
        { type: "separator" },
        { label: "Theme", submenu: THEMES.map(([id, label]) => ({ label, type: "radio", checked: id === currentTheme, click: () => send("theme", id) })) },
        { type: "separator" },
        t("Make Text Bigger", "bigger", "Cmd+Plus"),
        t("Make Text Smaller", "smaller", "Cmd+-"),
        t("Actual Size", "zoomReset", "Cmd+0"),
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        t("Next Tab", "nextTab", "Shift+Cmd+]"),
        t("Previous Tab", "prevTab", "Shift+Cmd+["),
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      role: "help",
      submenu: [
        t("Keyboard Shortcuts & Tips", "help", "Cmd+/"),
        t("What’s New", "whatsnew"),
        { label: "Show Data Folder in Finder", click: () => shell.showItemInFolder(app.getPath("userData")) },
        { type: "separator" },
        { label: "Report a Problem…", click: () => openExternalSafe(reportProblemUrl()) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Opens a new GitHub issue from the bug template with the Edith and macOS versions filled in
const ISSUES_URL = "https://github.com/Dylan-Ashton/edith/issues/new";
function reportProblemUrl() {
  const q = new URLSearchParams({
    template: "bug_report.yml",
    "edith-version": app.getVersion(),
    "macos-version": (process.platform === "darwin" ? "macOS " : process.platform + " ") + process.getSystemVersion(),
  });
  return ISSUES_URL + "?" + q.toString();
}

// ---------- IPC ----------
const FILTERS = {
  document: [{ name: "Documents", extensions: ["md", "markdown", "txt", "docx", "pdf", "rtf", "html", "htm"] }],
  import: [{ name: "Word, PDF, Rich Text, HTML or text", extensions: ["docx", "pdf", "rtf", "html", "htm", "txt"] }],
  md: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  html: [{ name: "HTML", extensions: ["html"] }],
};
ipcMain.handle("open-dialog", async (e, kind) => {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: FILTERS[kind] || FILTERS.document });
  if (r.canceled) return null;
  grant(r.filePaths[0]);
  return r.filePaths[0];
});
ipcMain.handle("save-dialog", async (e, suggestedName, kind) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath("documents"), path.basename(String(suggestedName || "untitled.md"))),
    filters: FILTERS[kind] || FILTERS.md,
  });
  if (r.canceled || !r.filePath) return null;
  grant(r.filePath);
  return r.filePath;
});
ipcMain.handle("read-file", async (e, p) => {
  if (!canUseFile(p)) return DENIED;
  try {
    const bytes = await fs.promises.readFile(p);
    const st = await fs.promises.stat(p);
    return { ok: true, bytes, mtime: st.mtimeMs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("write-file", async (e, p, text) => {
  if (!canUseFile(p) || typeof text !== "string") return DENIED;
  try {
    // Written in place rather than via a temp file + rename: a rename makes macOS treat it as a new
    // download (the Downloads stack bounces) and breaks Finder tags/comments on the file.
    await fs.promises.writeFile(p, text, "utf8");
    const st = await fs.promises.stat(p);
    app.addRecentDocument(p);
    return { ok: true, mtime: st.mtimeMs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("write-binary", async (e, p, bytes) => {
  if (!canWriteBinary(p)) return DENIED;
  try {
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, Buffer.from(bytes));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("read-head", async (e, p) => {
  if (!canUseFile(p)) return DENIED;
  try {
    const fh = await fs.promises.open(p, "r");
    const buf = Buffer.alloc(1200);
    const { bytesRead } = await fh.read(buf, 0, 1200, 0);
    await fh.close();
    return { ok: true, text: buf.toString("utf8", 0, bytesRead) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("stat", async (e, p) => {
  if (!canUseFile(p)) return DENIED;
  try {
    const st = await fs.promises.stat(p);
    return { ok: true, mtime: st.mtimeMs, size: st.size };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("ask-three", async (e, message, detail, buttons) => {
  const r = await dialog.showMessageBox(win, { type: "warning", buttons, defaultId: 0, cancelId: 1, message, detail });
  return r.response;
});
ipcMain.handle("ask-close", async (e, name) => {
  const r = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Save", "Cancel", "Don’t Save"],
    defaultId: 0,
    cancelId: 1,
    message: "Do you want to save the changes you made to " + name + "?",
    detail: "Your changes will be lost if you don’t save them.",
  });
  return r.response;
});
ipcMain.on("close-confirmed", () => {
  closeConfirmed = true;
  if (win) win.close();
});
ipcMain.on("doc-state", (e, s) => {
  if (!win) return;
  win.setRepresentedFilename(s.path || "");
  win.setDocumentEdited(!!s.dirty);
});
ipcMain.on("recent", (e, list) => {
  recentList = Array.isArray(list) ? list : [];
  buildMenu();
});
ipcMain.on("set-theme", (e, id) => {
  currentTheme = id;
  nativeTheme.themeSource = DARK_THEMES.has(id) ? "dark" : "light";
  buildMenu();
});
ipcMain.handle("read-clipboard", () => clipboard.readText());
ipcMain.handle("paths", () => ({ userData: app.getPath("userData"), documents: app.getPath("documents") }));
ipcMain.on("show-in-folder", (e, p) => {
  if (canUseFile(p)) shell.showItemInFolder(norm(p));
});
// Removed from Recent on Home, and not open in a tab: the page gives the file up until the user opens it again.
// This can only take access away.
ipcMain.on("forget-file", (e, p) => {
  const r = norm(p);
  if (!r) return;
  loadAllowed();
  if (allowed.delete(r)) saveAllowed();
});
// A file dropped on the window: the preload resolves its path with webUtils.getPathForFile, which only
// returns a path for a real file the user dragged in, so the page cannot invent one.
ipcMain.on("grant-dropped", (e, p) => grant(p));
// One-time move to the allowlist for people updating from 3.7.2 or earlier: the files they already had open,
// in Open Recent or with notes. Accepted once per install, at startup, before any document is shown.
ipcMain.handle("seed-allowed", (e, list) => {
  loadAllowed();
  if (allowedSeeded) return false;
  allowedSeeded = true;
  for (const p of Array.isArray(list) ? list.slice(0, 500) : []) {
    const r = norm(p);
    try {
      if (r && /\.(md|markdown|txt)$/i.test(r) && fs.statSync(r).isFile()) grant(r);
    } catch (err) {}
  }
  saveAllowed();
  return true;
});

// ---------- Lifecycle ----------
app.on("open-file", (e, p) => {
  e.preventDefault();
  grant(p);
  if (win && win.webContents && !win.webContents.isLoading()) win.webContents.send("open-path", p);
  else pendingOpen.push(p);
});
// Update check: asks GitHub for the newest release and, if it is newer, offers to open the download page. Nothing is installed automatically.
// It uses Chromium's network stack (system proxy, timeouts) and always answers a manual check, even when GitHub cannot be reached;
// every attempt is also written to update-check.log in the data folder so a silent failure can be diagnosed.
const RELEASES_API = "https://api.github.com/repos/Dylan-Ashton/edith/releases?per_page=15";
const newer = (a, b) => {
  const x = String(a).replace(/^v/, "").split(".").map(Number),
    y = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};
const logUpdate = (msg) => {
  try {
    fs.appendFileSync(path.join(app.getPath("userData"), "update-check.log"), new Date().toISOString() + " " + msg + "\n");
  } catch (e) {}
};
async function latestRelease() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await net.fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Edith" }, signal: ctl.signal });
    if (!r.ok) throw new Error("GitHub answered " + r.status);
    const list = await r.json();
    // the whole list rather than /latest, so a release that was marked pre-release is still found
    return (
      (Array.isArray(list) ? list : [])
        .filter((x) => x && !x.draft && /^v?\d+\.\d+/.test(x.tag_name))
        .sort((a, b) => (newer(a.tag_name, b.tag_name) ? -1 : newer(b.tag_name, a.tag_name) ? 1 : 0))[0] || null
    );
  } finally {
    clearTimeout(timer);
  }
}
async function checkForUpdates(manual) {
  // no parent window: a standalone alert always shows, even if the window is minimised or already showing a sheet
  const say = (message, detail) => dialog.showMessageBox({ type: "info", message, detail, buttons: ["OK"] });
  if (manual) send("say", "Checking for updates…");
  try {
    const rel = await latestRelease();
    logUpdate("manual=" + !!manual + " running=" + app.getVersion() + " latest=" + (rel ? rel.tag_name : "none"));
    if (!rel) {
      if (manual) await say("No updates published yet.");
      return;
    }
    if (!newer(rel.tag_name, app.getVersion())) {
      if (manual) await say("Edith is up to date.", "You have version " + app.getVersion() + ".");
      return;
    }
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: "Edith " + rel.tag_name.replace(/^v/, "") + " is available",
      detail:
        "You have version " +
        app.getVersion() +
        ". Download the new zip, open it and double-click “Install Edith.command”. Your documents and settings are kept.",
      buttons: ["Open download page", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) openExternalSafe(rel.html_url);
  } catch (e) {
    logUpdate("manual=" + !!manual + " failed: " + (e && e.message));
    if (manual)
      await say(
        "Could not check for updates.",
        e && e.name === "AbortError"
          ? "GitHub did not answer in time. Check your internet connection and try again."
          : "Check your internet connection and try again. (" + (e && e.message) + ")",
      );
  }
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: "Edith",
    applicationVersion: app.getVersion(),
    version: "",
    credits: "Your Markdown files, finally readable.",
    copyright: "© 2026 Dylan Ricci",
  });
  buildMenu();
  createWindow();
  const argPath = process.argv.slice(1).find((a) => /\.(md|markdown|txt)$/i.test(a) && fs.existsSync(a));
  if (argPath) {
    grant(path.resolve(argPath));
    pendingOpen.push(path.resolve(argPath));
  }
  app.on("activate", () => {
    if (!win) createWindow();
  });
  setTimeout(() => checkForUpdates(false), 8000);
});
app.on("window-all-closed", () => app.quit());
