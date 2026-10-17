// Electron: open from Finder, autosave, flush on tab switch, quit, session restore.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
import fs from 'fs';
fs.writeFileSync('/tmp/edith-a.md', '# Doc A\n\nAlpha paragraph.\n'); fs.writeFileSync('/tmp/edith-b.md', '# Doc B\n\nBeta.\n');
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.waitForTimeout(1500);
log('app name:', await app.evaluate(({ app }) => [app.name, app.getPath('userData')]));
const send = (a, arg) => app.evaluate(({ BrowserWindow }, [a, arg]) => BrowserWindow.getAllWindows()[0].webContents.send('menu', a, arg), [a, arg]);
await app.evaluate(({ app }) => app.emit('open-file', { preventDefault() {} }, '/tmp/edith-a.md')); await p.waitForTimeout(600);
await app.evaluate(({ app }) => app.emit('open-file', { preventDefault() {} }, '/tmp/edith-b.md')); await p.waitForTimeout(600);
log('tabs:', await p.locator('.tab').count(), 'active:', await p.inputValue('#fname'));
// edit doc B, autosave should write file
await p.click('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror'); await p.keyboard.press('Meta+End'); await p.keyboard.type(' Edited.'); await p.waitForTimeout(3500);
log('file B now:', JSON.stringify(fs.readFileSync('/tmp/edith-b.md','utf8')));
// switch tab, edit A, switch back quickly (flush test)
await send('prevTab'); await p.waitForTimeout(300); await p.click('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror'); await p.keyboard.press('Meta+End'); await p.keyboard.type(' More.'); await p.waitForTimeout(100); await send('nextTab'); await p.waitForTimeout(600);
log('file A after flush:', JSON.stringify(fs.readFileSync('/tmp/edith-a.md','utf8')));
// title / represented
log('title:', await p.title(), 'repr:', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getRepresentedFilename()));
await p.screenshot({ path: 's5.png' });
// close window: nothing dirty -> exits, session saved
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await new Promise(r=>setTimeout(r,1500));
log('exited:', await app.evaluate(() => 1).then(()=>false).catch(()=>true));
await app.close().catch(()=>{});
// relaunch: session restored?
const app2 = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p2 = await app2.firstWindow(); await p2.waitForTimeout(1800);
log('restored tabs:', await p2.locator('.tab').count(), 'names:', await p2.evaluate(()=>[...document.querySelectorAll('.tab .n')].map(n=>n.textContent)));
ok('app is named Edith', /^app name: \["Edith",/.test(out[0] || ''));
ok('two files open, the second active', /^tabs: 2 active: edith-b\.md$/.test(out[1] || ''));
ok('autosave writes into the open file', /Beta\. Edited\./.test(out[2] || ''));
ok('switching tabs flushes the pending save', /Alpha paragraph\. More\./.test(out[3] || ''));
ok('closing the window with nothing unsaved quits', /^exited: true$/.test(out[5] || ''));
ok('tabs are restored on the next launch', /^restored tabs: 2 names: \["edith-a\.md","edith-b\.md"\]$/.test(out[6] || ''));
await app2.close();
