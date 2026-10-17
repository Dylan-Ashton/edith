# Contributing to Edith

Edith is a Mac Markdown editor for people who don't write code: WYSIWYG editing of `.md` files on top of Toast UI Editor, saved back as clean Markdown. It is an Electron app for Apple Silicon, and the same page also runs as a single HTML file in Chrome.

Bug reports and feature requests go in [GitHub issues](https://github.com/Dylan-Ashton/edith/issues). Security problems go through private reporting; see [SECURITY.md](SECURITY.md).

## Setup

Requirements: Node 22.12 or newer, Python 3 (standard library only), and a Mac to run or package the app. Building and the browser tests work on Linux too.

```
npm install
npx playwright install chromium      # browser for the tests
npm run build                        # vendor.min.js -> dist.html -> electron-app/index.html
npm run dev                          # build and run the app (needs a display; Mac)
npm test                             # browser tests (t*.mjs), against dist.html
npm run test:electron                # Electron tests (te*.mjs); on Linux they run under xvfb-run
npm run package                      # build/Edith-darwin-arm64/Edith.app (Mac only)
```

`dist.html`, `vendor.min.js` and `electron-app/index.html` are build outputs. They are gitignored; never edit them.

## Tests

Each test is a standalone Playwright script that prints `PASS` / `FAIL` lines; `tests/run.mjs` runs them and fails on a crash, a `FAIL` line or a page error. Run one with `node tests/t16.mjs` from the repo root after `npm run build` (Electron ones: `xvfb-run node tests/te2.mjs` on Linux). Browser tests load `dist.html` over `file://`, so rebuild before testing.

- The Electron tests run in order and share one data folder (`te2` restarts the app and expects its session back). `tests/run.mjs` points them at a throwaway folder through `EDITH_TEST_USER_DATA`; if you run one by hand without it, it uses your real Edith data folder.
- Electron tests that leave a tab dirty end with `process.exit` rather than `app.close()`, which would open a native dialog. Wrap them in `timeout` when running by hand.
- Selectors are scoped to `.tabview:not([hidden])` (every tab has its own editor).
- Import fixtures live in `tests/fixtures/`; `make_fixtures.py` regenerates them (`pip install python-docx reportlab`).
- CI (`.github/workflows/test.yml`) builds and runs the browser tests on every pull request, and builds the Mac app on a `macos-14` runner exactly as a release does (`npm run package`, then `scripts/mac-zip.sh`, which fails unless the app exists, carries the expected Electron version and is arm64 only). The zip is attached to the workflow run as the `Edith-PR-build` artifact for 7 days: open the PR's Checks tab → Test → Summary → Artifacts. Nothing is tagged or released.

Rerun every test, both suites, after touching Toast UI, Electron or pdf.js.

## Architecture

| File | What it is |
|---|---|
| `app.template.html` | All HTML and CSS, with `/*__INLINE_CSS|JS|RAW|JSON|WORKER|FONTS:path__*/` markers and the Content-Security-Policy meta tag |
| `build.py` | Inlines the libraries, fonts, `CHANGELOG.md` (as JSON, shown in-app under What's new) and `app.js` into one `dist.html` (~4.6 MB), and writes the CSP script hashes |
| `app.js` | All application logic (~150 KB, grown by targeted patches: make small edits and rerun the tests after each; `npm run format` keeps it Prettier-formatted) |
| `entry.js` | Bundled by esbuild into `vendor.min.js`: Toast UI Editor 3.2.2, ProseMirror pieces (as `window.PM`), Turndown + GFM, jsdiff |
| `electron-app/main.js` | Window, menus, dialogs, file IO, the file allowlist, navigation lockdown, update check, About panel |
| `electron-app/preload.js` | The `window.native` bridge |
| `extend.plist` | Document types, minimum macOS and copyright, merged into the app's Info.plist |
| `fonts/` | Which Fontsource stylesheets are bundled (`fonts.list`) and their licenses |
| `installer/` | `Install Edith.command` and `READ ME FIRST.md`, zipped with the app by the release workflow |
| `docs/` | The website (GitHub Pages from `main` → `/docs`) |
| `brand/` | Icon source (`boat.py`) and `edith.icns`; the brand sheet is `Edith Brand.md` |

`app.js` section order: prefs → helpers → IndexedDB → tabs (each tab owns a Toast UI Editor; `T` is the active tab; `flushTab` settles timers before switching; `homeShown`) → document text and notes → change tracking and autosave (debounce scales with size) → stats and zoom → outline → find → notes and decorations → typing shortcuts, smart paste, scroll-sync snap → history and diff → load, save, import, export → toolbar and overflow → find bar → layout, themes, prefs → keyboard (capture phase) → startup and session restore.

Main ↔ page: menu items send a `menu` IPC with an action name, run by the `ACT` map in `app.js`. The page runs in two modes and both must keep working: Electron (`window.native` exists, native dialogs, real paths) and a plain HTML file in Chrome (`native` is null, File System Access API, `.browser-only` elements).

### Conventions that bite

- Per-document state lives on the tab object, never in module-level variables.
- Notes are kept by Edith, not in the `.md`: IndexedDB `mdeditor` store `notes` (`{key, notes, trash, fp, at}`, key = file path), mirrored as JSON in `<data folder>/notes-backup/`. `serializeFrom` writes text only. A legacy trailing `<!-- mdnotes {...} -->` comment is read once by `splitNotes` and migrated by `adoptNotes`. A moved file is re-linked by `fingerprint` when the old path no longer exists. Highlights are ProseMirror decorations (`nodeName: 'span'`, so overlapping notes nest), so the document is never changed.
- Version history is IndexedDB `mdeditor` (`versions` = full text, `meta` = listings). Always write both through `addVersion` / `deleteVersion`; use `rekeyVersions` when a file gets a path (`untitled:<tabId>` before that).
- Saves are in-place writes, not temp file + rename (a rename makes macOS treat the file as new: the Downloads stack bounces and Finder tags are lost). They are guarded by the external-change check; keep both.
- Modals close through `hideModal`; never remove `.on` directly.
- Never style `ul > li::before` without excluding `.task-list-item` (that broke checklists once).
- Other storage: localStorage `edith.prefs` and `edith.session`; all of it lives in `~/Library/Application Support/Edith`.

### Fragile Toast UI internals

Edith depends on these; recheck them after any Toast UI upgrade: `editor.wwEditor.view`, `editor.mdEditor.view`, `view.setProps` (decorations, `handleTextInput`), `editor.scrollSync.run` (patched to snap) and `scrollSync.syncPreviewScrollTop`, `Editor.factory({ viewer: true })`, `hooks.addImageBlobHook`, and the DOM classes `.toastui-editor-ww-container .ProseMirror`, `.toastui-editor-md-container .ProseMirror`, `.toastui-editor-md-preview`.

### Security model

People open their own files in Edith, including HTML, Word and PDF from anywhere, so the page is treated as untrusted:

- **Navigation**: `will-navigate` always blocks, so nothing can replace the app page (a local `.html` loaded in its place would get `window.native`). New windows are denied. Only `https:`, `http:` and `mailto:` links are handed to the default browser or mail app.
- **File bridge**: `read-file`, `write-file`, `stat` and `read-head` only accept paths the user chose: open and save dialogs, drag and drop (the preload resolves the path with `webUtils.getPathForFile`, which only works for a real dropped file), Finder Open With, and the command line. The list is kept by the main process in `<data folder>/allowed-files.json` (most recent 2000), so Open Recent and restored tabs keep working. Removing a document from Recent on Home (the × on its card, `forget-file`) also takes it off this list unless a tab has it open; that call can only remove access. `write-binary` may also write into the `<file>-images/` folder beside a chosen file and `.json` files in `notes-backup/`. Profiles from 3.7.2 and earlier are seeded once at startup from the open tabs, recent files and note keys.
- **CSP** (meta tag in `app.template.html`): `default-src 'none'`; scripts only by the sha256 hashes `build.py` computes, so nothing remote and no `unsafe-inline`; `connect-src https://api.github.com`; `object-src`, `frame-src` (printing uses a `srcdoc` frame, which needs none), `base-uri` and `form-action` `'none'`; fonts from `data:`; pictures from the app's own `file:` origin, `data:` and `blob:` only, so a picture from the web is never requested.
- **Network**: the only request is the update check in `main.js` (GitHub releases API), on launch and from Edith → Check for Updates…. It never installs anything.
- **pdf.js** runs with `isEvalSupported: false`, in a classic worker built from the inlined worker source (a module worker cannot start from a `blob:` URL in a `file://` page).

## Known rough edges

1. Word import with images produces base64 data URIs inside the Markdown (mammoth's default), so documents get huge. Route images through `saveImage` or drop them with a placeholder.
2. PDF import is heuristic: tables and images are not rebuilt, scanned PDFs cannot be imported, complex slide decks come through as plain paragraphs.
3. A note whose passage is almost entirely rewritten loses its highlight (the card stays).
4. Replace all is one undoable transaction, but it does not match text that crosses a bold or italic boundary in Write mode.
5. Many tabs scroll sideways with no visible indicator; every new document is `untitled.md` until saved.
6. Unsaved-work recovery lives in localStorage (about 5–10 MB). A very large unsaved document cannot be kept; Edith warns.
7. The browser build has no recent-card previews and no Open Recent submenu.
8. Toast UI 3.2.2 inlines its own copy of DOMPurify 2.3.3, which has known sanitizer bypasses; npm overrides cannot reach it. The CSP blocks injected scripts and event handlers, which covers the practical risk, but replacing the sanitizer would mean patching the bundle.
9. Pictures linked from the web are never loaded (CSP); they show their alt text in a placeholder, on screen and in print. Relative picture paths are resolved against the document's folder for display only (`showImages` in `app.js`), so the Markdown keeps its paths; in the browser build, which has no file paths, they stay unresolved.
10. Distribution: ad-hoc signed, not notarised, so the installer needs "Open Anyway" once. No silent auto-update (that needs an Apple Developer ID and notarisation); Edith only says when a newer GitHub release exists.

## Release process

1. On a branch: bump the version in `package.json` (`version` and `--app-version` in the `package` script), `electron-app/package.json`, `APP_VERSION` in `app.js`, and the version text in `docs/index.html` (hero, download card, JSON-LD). Add a `CHANGELOG.md` entry written for users (it is shown in the app under What's new).
2. Merge the pull request.
3. Publish a GitHub release with a **new** tag `vX.Y.Z` targeting `main`. The tag push runs `.github/workflows/release.yml` on a macOS 14 (Apple Silicon) runner: `npm ci`, `npm run package`, check and zip `Edith.app` with the installer files (`scripts/mac-zip.sh`, shared with the PR build), attach `Edith (Apple Silicon).zip` to the release. It takes 5–10 minutes.
   - Re-publishing a release on an existing tag does not trigger a build; use a new tag.
   - The workflow can also be run by hand (Actions → Build Edith → Run workflow); the zip then appears as an `edith-mac` artifact on the run, not on a release.
   - Packaging only works on a Mac; don't try it on Linux.

The installer (`installer/Install Edith.command`) quits Edith (by bundle id `app.edith.mac`), replaces `/Applications/Edith.app` (or `~/Applications/Edith.app` if `/Applications` is not writable) only if the existing copy really is Edith, clears the quarantine flag, signs it ad hoc and opens it. It touches nothing else.

## Design decisions worth knowing

- Toast UI over CodeMirror for WYSIWYG and tables, fully offline.
- Electron over a Chrome app-mode wrapper (no browser in the Dock, no file-permission prompts, real menus and Preferences).
- Whole-document Markdown conversion runs once per change, debounced by document size; version listings live in a separate metadata store so the history panel stays fast.
- Notes are decorations and are stored outside the file, so the Markdown stays clean wherever it goes; Save a .md Copy with Notes exists for sending them along. Note type (change / ask / keep) is optional, and the copied prompt never tells the AI to revise something the writer only asked about.
- Open converts everything (Word, PDF, HTML, RTF); there is no separate Import.
- Home is a persistent view beside the tabs, not "close every tab to see it".
- Save stays a single-purpose button; exports are separate actions.
- Heading shortcuts follow Google Docs (⌥⌘0–4); ⌘0 is actual size.
