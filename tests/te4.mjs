// Electron: note in a table, note jump, find toggle, Open Recent submenu, Home with recent cards.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
import fs from 'fs';
fs.writeFileSync('/tmp/edith-a.md', '# Quarterly plan\n\nThis is the opening paragraph of a plan with enough text to make a thumbnail look like a page of writing.\n\n## Goals\n\n- One\n- Two\n');
fs.writeFileSync('/tmp/edith-b.md', '# Doc B\n\n| a | b |\n| --- | --- |\n| 15,267 | x |\n\n' + 'Filler paragraph. '.repeat(400) + '\n');
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.waitForTimeout(1500);
await p.setViewportSize({ width: 1400, height: 900 });
const send = (a) => app.evaluate(({ BrowserWindow }, a) => BrowserWindow.getAllWindows()[0].webContents.send('menu', a), a);
for (const f of ['/tmp/edith-a.md','/tmp/edith-b.md']) { await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), f); await p.waitForTimeout(600); }
await p.screenshot({ path: 'e1.png' });
// note on table cell text, then scroll away and click card
await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(300);
const pm='.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
await p.evaluate((s)=>{ const td=[...document.querySelectorAll(s+' td')].find(t=>t.textContent.includes('15,267')); const r=document.createRange(); r.selectNodeContents(td.querySelector('p')||td); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); }, pm);
await send('note'); await p.waitForTimeout(300); await p.fill('#noteText','TEST'); await p.click('#noteSave'); await p.waitForTimeout(400);
await p.evaluate((s)=>{ const sp=document.querySelector(s); sp.scrollTop=sp.scrollHeight; }, pm);
log('marks:', await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .note-mark').length), 'quote:', await p.evaluate(()=>document.querySelector('.note-card .q')?.textContent));
const before = await p.evaluate((s)=>document.querySelector(s).scrollTop, pm);
await p.click('.note-card'); await p.waitForTimeout(900);
const after = await p.evaluate((s)=>document.querySelector(s).scrollTop, pm);
log('note jump scrolled:', before, '->', after, 'pulse:', await p.evaluate(()=>!!document.querySelector('.note-mark.pulse')));
// find toggle
await p.click('#btnFind'); await p.waitForTimeout(100); const o1 = await p.isVisible('#findbar.on'); await p.click('#btnFind'); await p.waitForTimeout(100); log('find toggles:', o1, await p.isVisible('#findbar.on'));
// theme menu
await p.click('#btnTheme'); await p.waitForTimeout(150); await p.screenshot({ path: 'e2.png', clip: { x: 1000, y: 0, width: 400, height: 420 } }); await p.keyboard.press('Escape');
// close all -> home
await send('home'); await p.waitForTimeout(600); log('recent submenu items:', await app.evaluate(({ Menu }) => { const m = Menu.getApplicationMenu(); const f = m.items.find(i => i.label === 'File'); const r = f.submenu.items.find(i => i.label === 'Open Recent'); return r.submenu.items.map(i => i.label); }));
log('home:', await p.isVisible('#start'), 'cards:', await p.locator('.rcard').count(), 'body.home:', await p.evaluate(()=>document.body.classList.contains('home')));
await p.screenshot({ path: 'e3.png' });
ok('note on a table cell', /^marks: [1-9]\d* quote: “15,267”$/.test(out[0] || ''));
ok('clicking a note jumps to its highlight and pulses it', /-> 0 pulse: true$/.test(out[1] || ''));
ok('Find button toggles the find bar', /^find toggles: true false$/.test(out[2] || ''));
ok('Open Recent lists recent files', /^recent submenu items: \[.*"edith-a\.md".*\]$/.test(out[3] || ''));
ok('Home shows recent cards', /^home: true cards: [1-9]\d* body\.home: true$/.test(out[4] || ''));
process.exit(0);
