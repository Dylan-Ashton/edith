// Electron: notes live in Edith, not in the .md; they survive a restart and a rename; legacy comments migrate; undo works inside the note box.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
import fs from 'fs';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const ud = '/tmp/edith-ud-' + Date.now(); const f = '/tmp/edith-n1.md', f2 = '/tmp/edith-n1-renamed.md', leg = '/tmp/edith-legacy.md';
fs.writeFileSync(f, '# Plot\n\nThe hero betrays the mentor at midnight, quietly, and nobody sees it happen at all.\n\nSecond paragraph here with enough words to fingerprint this document uniquely.\n');
fs.writeFileSync(leg, '# Old\n\nSome old text with a legacy note attached to it for migration purposes today.\n\n<!-- mdnotes {"v":1,"notes":[{"id":"abc","quote":"legacy note","ctx":"with a ","text":"from the old format","created":1,"done":false}]} -->\n');
const launch = async () => { const app = await electron.launch({ args: ['electron-app', '--no-sandbox', '--user-data-dir=' + ud], env: { ...process.env, EDITH_TEST_USER_DATA: ud }, executablePath: electronPath }); const p = await app.firstWindow(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); await p.waitForTimeout(1500); return { app, p }; };
const open = async (app, p, path) => { await app.evaluate(({ app }, path) => app.emit('open-file', { preventDefault() {} }, path), path); await p.waitForTimeout(900); };
const sel = (p, t) => p.evaluate((t) => { const pm = document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror'); const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf(t); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pm.focus(); return true; } } return false; }, t);
let { app, p } = await launch();
await open(app, p, f); await sel(p, 'betrays the mentor'); await p.keyboard.press('Meta+Shift+M'); await p.waitForTimeout(200);
await p.fill('#noteText', 'Is this the right moment?'); await p.click('#noteSave'); await p.waitForTimeout(900);
// undo inside the note box undoes the note text, not the document
await sel(p, 'Second paragraph'); await p.keyboard.press('Meta+Shift+M'); await p.waitForTimeout(200);
await p.keyboard.type('hello world'); await p.waitForTimeout(100);
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'undo')); await p.waitForTimeout(300);
const ta = await p.inputValue('#noteText'); ok('undo in the note box acts on the note text (' + JSON.stringify(ta) + ')', ta.length < 'hello world'.length);
ok('...and the dialog and document are still there', await p.evaluate(() => document.getElementById('mNote').classList.contains('on') && document.querySelectorAll('.tab').length >= 1));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.keyboard.press('Meta+s'); await p.waitForTimeout(800);
const disk = fs.readFileSync(f, 'utf8'); ok('the saved .md has no notes in it', !/mdnotes|<!--/.test(disk) && /betrays the mentor/.test(disk));
ok('saving a note does not mark the file as changed', await p.evaluate(() => !document.querySelector('.tab.active').classList.contains('dirty')));
ok('a plain-text backup of the notes exists', fs.existsSync(ud + '/notes-backup') && fs.readdirSync(ud + '/notes-backup').length >= 1);
// delete -> recently deleted -> restore
await p.click('[data-tab=notes]'); await p.click('.note-card [data-a=del]'); await p.waitForTimeout(500);
ok('deleted note appears under Recently deleted', await p.evaluate(() => /Recently deleted \(1\)/.test(document.querySelector('details.trash summary')?.textContent || '')));
await p.click('details.trash summary'); await p.click('.trash-row button'); await p.waitForTimeout(400);
ok('Restore brings it back', await p.evaluate(() => document.querySelectorAll('.note-card').length === 1));
await p.waitForTimeout(800); await app.close().catch(() => {});
// restart: notes come back
({ app, p } = await launch());
ok('notes survive a restart', await p.evaluate(() => document.querySelectorAll('.note-card').length === 1 && /right moment/.test(document.querySelector('.note-card .t').textContent)));
await app.evaluate(() => 0); 
// legacy file migrates
await open(app, p, leg);
ok('a legacy trailing comment becomes a note', await p.evaluate(() => /from the old format/.test(document.body.innerText)));
await p.waitForTimeout(2800); const legDisk = fs.readFileSync(leg, 'utf8');
ok('...and the file is cleaned on the next save (autosave)', !/mdnotes/.test(legDisk));
// rename: notes found again by content
await app.evaluate(() => 0); await p.keyboard.press('Meta+w'); await p.waitForTimeout(400);
await p.waitForTimeout(500); await app.close().catch(() => {});
fs.renameSync(f, f2);
({ app, p } = await launch()); await open(app, p, f2); await p.click('[data-tab=notes]');
ok('notes follow a renamed file', await p.evaluate(() => document.querySelectorAll('.note-card').length === 1));
process.exit(0);
