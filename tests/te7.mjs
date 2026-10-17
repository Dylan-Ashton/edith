// Electron security: the app page can never be replaced (links, location changes, window.open), only web and mail
// links reach the default browser, the Content-Security-Policy is in force, and the file bridge only touches files
// the user chose (dialogs, Finder, drag and drop) plus the "<file>-images" folder beside them.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
import fs from 'fs';
const D = fs.mkdtempSync('/tmp/edith-sec-'); // fresh paths every run: the allowlist persists between runs
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
fs.writeFileSync(`${D}/evil.html`, '<script>window.__evil = 1</script><p>evil</p>');
fs.writeFileSync(`${D}/outside.txt`, 'private');
fs.writeFileSync(`${D}/doc.md`, '# Doc\n\nText.\n');
fs.writeFileSync(`${D}/drop.md`, '# Dropped\n');
fs.writeFileSync(`${D}/seed.md`, '# Seed\n');
fs.writeFileSync(`${D}/doc2.md`, '# Doc 2\n');

const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.waitForTimeout(1500);
const indexUrl = p.url();
// record what would be handed to the default browser instead of opening it
await app.evaluate(({ shell }) => { globalThis.__ext = []; shell.openExternal = async (u) => { globalThis.__ext.push(u); }; });
const ext = () => app.evaluate(() => globalThis.__ext.splice(0));
const stillApp = async () => p.url() === indexUrl && (await p.evaluate(() => !!window.native && !window.__evil));

// drag and drop: the path comes from a real File (webUtils.getPathForFile), not from the page
// (done first: Playwright's file chooser waits on navigations, and the tests below start and block several)
const call = (fn, ...a) => p.evaluate(([fn, a]) => window.native[fn](...a), [fn, a]);
ok('before the drop the file is refused', (await call('readFile', `${D}/drop.md`)).denied);
await p.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.id = 'secDrop'; document.body.appendChild(i); });
await p.setInputFiles('#secDrop', `${D}/drop.md`);
const dropped = await p.evaluate(() => window.native.pathFor(document.getElementById('secDrop').files[0]));
await p.waitForTimeout(200);
ok('dropped file resolves to its path', dropped === `${D}/drop.md`);
ok('...and becomes readable', (await call('readFile', `${D}/drop.md`)).ok);
ok('a made-up File gets no path', (await p.evaluate(() => window.native.pathFor(new File(['x'], '/etc/hosts')))) === null);


// ---- navigation
await p.evaluate((u) => { location.href = u; }, `file://${D}/evil.html`); await p.waitForTimeout(700);
ok('location change to a local .html file is blocked', await stillApp());
ok('...and it is not opened elsewhere', (await ext()).length === 0);
const click = async (href) => { await p.evaluate((h) => { const a = document.createElement('a'); a.href = h; a.textContent = 'x'; document.body.appendChild(a); a.click(); a.remove(); }, href); await p.waitForTimeout(600); };
await click(`file://${D}/evil.html`);
ok('clicked link to a local .html file stays out of the window', await stillApp());
ok('...and is not opened externally', (await ext()).length === 0);
await click('https://example.com/page');
ok('clicked https link leaves the app page alone', await stillApp());
ok('...and goes to the default browser', JSON.stringify(await ext()) === '["https://example.com/page"]');
await click('mailto:someone@example.com');
ok('mailto link goes to the mail app', JSON.stringify(await ext()) === '["mailto:someone@example.com"]');
await click('smb://server/share'); await click('javascript:void(0)');
ok('other schemes are dropped', (await ext()).length === 0 && await stillApp());
await p.evaluate((u) => { window.open(u); window.open('ftp://example.com/x'); window.open('http://example.com/'); }, `file://${D}/evil.html`); await p.waitForTimeout(600);
ok('window.open: only the web link is handed out', JSON.stringify(await ext()) === '["http://example.com/"]');
ok('window.open never creates a window', (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 1);

// ---- context menu "Open Link in Browser" only for safe links
const menuFor = (linkURL) => app.evaluate(({ Menu, BrowserWindow }, linkURL) => {
  const orig = Menu.buildFromTemplate; let labels = null;
  Menu.buildFromTemplate = (t) => { labels = t.map((i) => i.label || i.role || i.type); return { popup() {} }; };
  try { BrowserWindow.getAllWindows()[0].webContents.emit('context-menu', { preventDefault() {} }, { dictionarySuggestions: [], misspelledWord: '', selectionText: '', isEditable: false, linkURL }); } finally { Menu.buildFromTemplate = orig; }
  return labels;
}, linkURL);
ok('context menu offers https links', (await menuFor('https://example.com')).includes('Open Link in Browser'));
ok('context menu hides file: links', !(await menuFor('file:///Applications/Calculator.app')).includes('Open Link in Browser'));

// ---- Content-Security-Policy
const csp = await p.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '');
ok('CSP present with object-src none and GitHub-only connect-src', /object-src 'none'/.test(csp) && /connect-src https:\/\/api\.github\.com;/.test(csp) && /default-src 'none'/.test(csp));
ok('CSP script-src has no unsafe-inline, no remote hosts', /script-src ('sha256-[^']+' ?)+;/.test(csp) && !/script-src[^;]*(unsafe|https?:)/.test(csp));
const probe = await p.evaluate(async () => {
  const v = []; document.addEventListener('securitypolicyviolation', (e) => v.push(e.violatedDirective));
  const s = document.createElement('script'); s.textContent = 'window.__injected = 1'; document.body.appendChild(s);
  const img = document.createElement('img'); img.src = 'https://example.com/pixel.png'; document.body.appendChild(img);
  let fetched = 'blocked'; try { await fetch('https://example.com/'); fetched = 'allowed'; } catch (e) {}
  await new Promise((r) => setTimeout(r, 300));
  return { injected: !!window.__injected, fetched, v: v.join(',') };
});
ok('injected inline script does not run', !probe.injected);
ok('remote image and fetch are blocked', probe.fetched === 'blocked' && /img-src/.test(probe.v) && /connect-src/.test(probe.v));

// ---- file bridge
let r = await call('readFile', `${D}/outside.txt`);
ok('readFile refuses a file the user never chose', r.ok === false && r.denied === true);
ok('stat and readHead refuse it too', (await call('stat', `${D}/outside.txt`)).denied && (await call('readHead', '/etc/hosts')).denied);
r = await call('writeFile', `${D}/written.txt`, 'x');
ok('writeFile refuses an unchosen path and writes nothing', r.denied && !fs.existsSync(`${D}/written.txt`));
ok('writeBinary refuses an arbitrary path', (await call('writeBinary', `${D}/evil-images/x.png`, [1, 2])).denied && !fs.existsSync(`${D}/evil-images`));
ok('relative and odd paths are refused', (await call('readFile', 'doc.md')).denied && (await call('readFile', `${D}/../${D.split('/').pop()}/outside.txt`)).denied);

await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), `${D}/doc.md`); await p.waitForTimeout(900);
ok('a file opened from Finder is readable', (await call('readFile', `${D}/doc.md`)).ok && (await call('stat', `${D}/doc.md`)).ok);
ok('...and writable', (await call('writeFile', `${D}/doc.md`, '# Doc\n\nText. Saved.\n')).ok);
ok('pasted image may go into <file>-images', (await call('writeBinary', `${D}/doc-images/image-1.png`, [137, 80])).ok && fs.existsSync(`${D}/doc-images/image-1.png`));
ok('...but not escape it', (await call('writeBinary', `${D}/doc-images/../written.txt`, [1])).denied && !fs.existsSync(`${D}/written.txt`));
const ud = await app.evaluate(({ app }) => app.getPath('userData'));
ok('notes backup folder is writable', (await call('writeBinary', ud + '/notes-backup/abc-test.md.json', [123, 125])).ok);
ok('...only for .json files directly inside it', (await call('writeBinary', ud + '/window.json', [1])).denied && (await call('writeBinary', ud + '/notes-backup/x.sh', [1])).denied);

// open and save dialogs grant the chosen path
await app.evaluate(({ dialog }, D) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [D + '/seed.md'] }); dialog.showSaveDialog = async () => ({ canceled: false, filePath: D + '/written.txt' }); }, D);
ok('seeding again after startup is refused', (await call('seedAllowed', [`${D}/doc2.md`])) === false && (await call('readFile', `${D}/doc2.md`)).denied);
await call('openDialog', 'document');
ok('open dialog grants the chosen file', (await call('readFile', `${D}/seed.md`)).ok);
await call('saveDialog', 'x.md', 'md');
ok('save dialog grants the chosen file', (await call('writeFile', `${D}/written.txt`, 'saved')).ok && fs.readFileSync(`${D}/written.txt`, 'utf8') === 'saved');

const allowedJson = JSON.parse(fs.readFileSync(ud + '/allowed-files.json', 'utf8'));
ok('allowlist is kept in the data folder', allowedJson.seeded === true && allowedJson.files.includes(`${D}/doc.md`) && !allowedJson.files.includes(`${D}/outside.txt`));
ok('no page errors', errs.length === 0);
if (errs.length) console.log(errs.join('\n'));
process.exit(0);
