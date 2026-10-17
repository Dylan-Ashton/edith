// Electron: external-change guard stops autosave from overwriting another app's edit; pasted images saved beside the file.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
import fs from 'fs';
fs.rmSync('/tmp/edith-c-images', { recursive: true, force: true }); // images from an earlier run would show up in the listing below
fs.writeFileSync('/tmp/edith-c.md', '# Doc C\n\nOriginal.\n');
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.waitForTimeout(1500);
await app.evaluate(({ app }) => app.emit('open-file', { preventDefault() {} }, '/tmp/edith-c.md')); await p.waitForTimeout(800);
const pm = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(300); await p.click(pm); await p.keyboard.press('Meta+End'); await p.keyboard.type(' Mine.'); await p.waitForTimeout(300);
await new Promise(r=>setTimeout(r,1200)); fs.writeFileSync('/tmp/edith-c.md', '# Doc C\n\nChanged elsewhere.\n'); // external edit before autosave fires
await p.waitForTimeout(3500);
log('disk after autosave attempt:', JSON.stringify(fs.readFileSync('/tmp/edith-c.md','utf8')), '| status:', await p.textContent('#stMsg'));
// image paste -> saved next to file
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
await p.evaluate(async (b64) => { const bytes = Uint8Array.from(atob(b64), c=>c.charCodeAt(0)); const blob = new Blob([bytes], {type:'image/png'}); const dt = new DataTransfer(); dt.items.add(new File([blob],'shot.png',{type:'image/png'})); document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); }, png.toString('base64'));
await p.waitForTimeout(800);
log('image dir:', fs.existsSync('/tmp/edith-c-images') ? fs.readdirSync('/tmp/edith-c-images') : 'none', '| status:', await p.textContent('#stMsg'));
await p.click('[data-mode=markdown]'); await p.waitForTimeout(300); log((await p.evaluate(()=>document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText)).slice(-120));
ok('autosave does not overwrite a file another app changed', /Changed elsewhere\..*changed by another app/.test(out[0] || ''));
ok('pasted image saved into <file>-images', /^image dir: \[\"image-\d+\.png\"\] \| status: Image saved to edith-c-images\//.test(out[1] || ''));
ok('and linked from the document', /!\[shot\.png\]\(edith-c-images\/image-\d+\.png\)$/.test(out[2] || ''));
process.exit(0);
