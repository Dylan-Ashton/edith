# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

Edith is a local Mac Markdown editor (Electron, Apple Silicon only) for non-technical users: WYSIWYG editing of `.md` files on top of Toast UI Editor, saved back as clean Markdown. `CONTRIBUTING.md` is the full developer guide (architecture, security model, fragile Toast UI internals, known rough edges, release process); read it before substantial work. The brand sheet (colours, type, voice) is `Edith Brand.md`.

## Commands

```
npm install
npx playwright install chromium     # tests only
npm run build     # esbuild entry.js -> vendor.min.js, build.py -> dist.html, copied to electron-app/index.html
npm run dev       # build + run Electron (needs a display; Mac)
npm test          # all browser tests (t*.mjs) through tests/run.mjs
npm run test:electron               # all Electron tests (te*.mjs), throwaway data folder, xvfb-run on Linux
node tests/t16.mjs                  # run one test (from repo root, after `npm run build`)
```

- `npm run package` builds the Mac `.app`; it only works on a Mac (CI runs it on `macos-14` on `v*` tags). Don't try it on Linux.
- There is no linter. Tests are standalone Playwright scripts that print `PASS`/`FAIL` lines; the browser ones load `dist.html` via `file://`, so rebuild before testing. Run both suites after any change. Run a single Electron test with `EDITH_TEST_USER_DATA=$(mktemp -d)` set, or it uses the real Edith data folder; wrap it in `timeout` and use `process.exit` rather than `app.close()` if a dirty tab would open a native dialog.
- `dist.html`, `vendor.min.js`, `electron-app/index.html` are build outputs and are gitignored; never edit them.

## Architecture

- `app.template.html` holds all HTML/CSS and the Content-Security-Policy meta tag, with `/*__INLINE_…:path__*/` markers; `build.py` inlines libraries, the bundled fonts (`fonts/fonts.list`), `CHANGELOG.md` (as JSON, shown in-app under What's new) and `app.js` into one ~4.6 MB `dist.html`, and fills in the CSP script hashes.
- `app.js` (~150 KB, grown by targeted patches; formatted with `npm run format`) is all application logic. Make small edits and rerun tests after each. Section order is in CONTRIBUTING.md.
- `entry.js` bundles Toast UI Editor + ProseMirror (exposed as `window.PM`), Turndown, jsdiff into `vendor.min.js`. pdf.js and mammoth are inlined separately.
- `electron-app/main.js` (window, menus, dialogs, file IO, update check) talks to the page through `electron-app/preload.js`, which exposes `window.native`. Menu items send a `menu` IPC with an action name, executed by the `ACT` map in `app.js`.
- The page runs in two modes: Electron (`window.native` exists) and a plain HTML file in Chrome (`native` is null, File System Access API, `.browser-only` elements). Keep both working.

## Conventions that bite

- Per-document state lives on the tab object (`T` is the active tab); never in module-level variables. Each tab owns its own Toast UI Editor.
- Notes are kept by Edith, not in the `.md` (since 3.6.0): IndexedDB `mdeditor`, store `notes`, keyed by file path, mirrored as JSON in `<data folder>/notes-backup/`. `serializeFrom` writes text only; a legacy trailing `<!-- mdnotes {...} -->` comment is read once by `splitNotes` and migrated by `adoptNotes`. Highlights are ProseMirror decorations, so the document itself is never changed.
- Version history is IndexedDB `mdeditor` (`versions` = full text, `meta` = listings). Always write both through `addVersion`/`deleteVersion`; use `rekeyVersions` when a file gets a path.
- The code depends on Toast UI internals (`editor.wwEditor.view`, `mdEditor.view`, `view.setProps`, patched `scrollSync.run`, `.toastui-editor-*` DOM classes). Rerun all tests after bumping Toast UI, Electron or pdf.js.
- Never style `ul > li::before` without excluding `.task-list-item` (caused the checklist bug).
- Saves are in-place writes (not temp+rename), guarded by the external-change check; don't change that.
- Security: the main process only lets the page read or write files the user chose (allowlist in `main.js`; a new way to open files must call `grant`), blocks every navigation away from the app page, and only opens `https:`/`http:`/`mailto:` links externally. Don't add inline event handlers, remote scripts or network requests: the CSP blocks them. The update check is the only network request, and the website promises that.

## Releasing

Bump the version in `package.json` (including the `--app-version` in the `package` script), `electron-app/package.json`, `APP_VERSION` in `app.js`, and the version text in `docs/index.html` (hero, download card, JSON-LD); add a user-facing `CHANGELOG.md` entry. After the PR is merged, a GitHub release with a **new** tag `vX.Y.Z` triggers the Mac build (re-publishing an existing tag doesn't). Details in CONTRIBUTING.md.
