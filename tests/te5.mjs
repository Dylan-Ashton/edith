// Electron: new menu items exist ("Copy Notes for Claude" became "Copy Notes as Prompt" in 3.7.0), and a manual "Check for Updates…" always answers (dialogs are stubbed so nothing blocks).
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.waitForTimeout(1500);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const labels = await app.evaluate(({ Menu }) => { const out = []; const walk = (items) => items.forEach((i) => { out.push(i.label); if (i.submenu) walk(i.submenu.items); }); walk(Menu.getApplicationMenu().items); return out; });
for (const l of ['Increase Indent', 'Decrease Indent', 'Show Notes Beside the Page', 'Copy Notes as Prompt', 'Save a .md Copy (Text Only)…', 'Save a .md Copy with Notes…', 'Check for Updates…', 'Report a Problem…']) ok('menu has "' + l + '"', labels.includes(l));
await app.evaluate(({ dialog }) => { globalThis.__dlg = []; dialog.showMessageBox = async (...a) => { globalThis.__dlg.push(a[a.length - 1]); return { response: 1 }; }; });
await app.evaluate(({ Menu }) => { const find = (items) => { for (const i of items) { if (i.label === 'Check for Updates…') return i; if (i.submenu) { const r = find(i.submenu.items); if (r) return r; } } }; find(Menu.getApplicationMenu().items).click(); });
for (let i = 0; i < 40 && !(await app.evaluate(() => globalThis.__dlg.length)); i++) await p.waitForTimeout(500);
const dlg = await app.evaluate(() => globalThis.__dlg);
console.log('  dialog:', JSON.stringify(dlg.map((d) => d.message + ' | ' + (d.detail || ''))));
ok('a manual update check always shows an answer', dlg.length === 1 && !!dlg[0].message);
// File → New Scratch from Clipboard reads the clipboard through the main process (Electron 44 made its clipboard API async)
await app.evaluate(async ({ clipboard }) => { await clipboard.writeText('# From the clipboard\n\nPasted text.'); });
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'scratch')); await p.waitForTimeout(800);
ok('New Scratch from Clipboard pastes the clipboard', /From the clipboard\s+Pasted text\./.test(await p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-contents').innerText)));
// Help → Report a Problem… opens the bug template with the versions filled in
const reportUrl = await app.evaluate(({ Menu, shell }) => { let u = null; shell.openExternal = async (x) => { u = x; }; const find = (items) => { for (const i of items) { if (i.label === 'Report a Problem…') return i; if (i.submenu) { const r = find(i.submenu.items); if (r) return r; } } }; find(Menu.getApplicationMenu().items).click(); return u; });
console.log('  report url:', reportUrl);
const ru = new URL(reportUrl), appVersion = await app.evaluate(({ app }) => app.getVersion());
ok('Report a Problem opens a prefilled bug report', ru.origin + ru.pathname === 'https://github.com/Dylan-Ashton/edith/issues/new' && ru.searchParams.get('template') === 'bug_report.yml' && ru.searchParams.get('edith-version') === appVersion && /\d/.test(ru.searchParams.get('macos-version') || ''));
console.log(errs.length ? 'FAIL page errors ' + errs.join('|') : 'PASS no page errors');
process.exit(0);
