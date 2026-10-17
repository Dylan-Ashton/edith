// Electron: pictures stored beside a document are shown (Write mode, Markdown preview, print), pictures linked from
// the web are never loaded and show their alt text quietly instead, and the Markdown is never changed by either.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
import fs from 'fs';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const D = fs.mkdtempSync('/tmp/edith-img-') + '/my notes #1'; // a folder name that needs URL escaping
fs.mkdirSync(D + '/doc-images', { recursive: true });
// a 4 x 3 PNG
fs.writeFileSync(D + '/doc-images/pic 1.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGP8z4AATEhsPBwAM9EBBQBfDmAAAAAASUVORK5CYII=', 'base64'));
const md = '# Pictures\n\n![A local picture](doc-images/pic%201.png)\n\nText between.\n\n![A chart from the web](https://example.com/chart.png)\n\nEnd.\n';
fs.writeFileSync(D + '/doc.md', md);

const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.waitForTimeout(1500);
const send = (a) => app.evaluate(({ BrowserWindow }, a) => BrowserWindow.getAllWindows()[0].webContents.send('menu', a), a);
await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), D + '/doc.md'); await p.waitForTimeout(1200);
await send('modeWrite'); await p.waitForTimeout(600);

const imgs = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, cls: i.className, alt: i.getAttribute('alt') })), sel);
let ww = await imgs('.tabview:not([hidden]) .toastui-editor-ww-container img');
console.log('  write mode:', JSON.stringify(ww.map((i) => ({ ...i, src: (i.src || '').slice(0, 60) }))));
const local = ww.find((i) => i.alt === 'A local picture'), web = ww.find((i) => i.alt === 'A chart from the web');
ok('local picture beside the document is shown in Write mode', !!local && local.w === 4 && (local.src || '').startsWith('file://') && local.src.endsWith('/doc-images/pic%201.png'));
ok('web picture shows a quiet placeholder, not a broken image', !!web && /img-web/.test(web.cls) && (web.src || '').startsWith('data:image/svg+xml') && web.w > 0);

await send('modeMarkdown'); await p.waitForTimeout(800);
const pv = await imgs('.tabview:not([hidden]) .toastui-editor-md-preview img');
ok('local picture is shown in the Markdown preview', pv.some((i) => i.alt === 'A local picture' && i.w === 4));
ok('web picture is a placeholder in the preview too', pv.some((i) => i.alt === 'A chart from the web' && /img-web/.test(i.cls)));
const rawMd = await p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText);
ok('Markdown text keeps the original image paths', rawMd.includes('](doc-images/pic%201.png)') && rawMd.includes('](https://example.com/chart.png)') && !rawMd.includes('file:') && !rawMd.includes('data:'));
await send('modeWrite'); await p.waitForTimeout(600);

// print: stub the print dialog and read the print frame (the app sets the frame's onload, which is wrapped here)
await p.evaluate(() => {
  window.__printed = null;
  Object.defineProperty(HTMLIFrameElement.prototype, 'onload', { configurable: true, set(fn) {
    this.addEventListener('load', () => {
      const d = this.contentDocument; this.contentWindow.print = () => {}; fn.call(this);
      setTimeout(() => { window.__printed = { imgs: [...d.images].map((i) => ({ alt: i.alt, w: i.naturalWidth, src: (i.getAttribute('src') || '').slice(0, 40) })), web: [...d.querySelectorAll('.img-web')].map((s) => s.textContent) }; }, 400);
    });
  } });
});
await send('print');
let printed = null;
for (let i = 0; i < 20 && !printed; i++) { await p.waitForTimeout(250); printed = await p.evaluate(() => window.__printed); }
printed = printed || { imgs: [], web: [] };
console.log('  print:', JSON.stringify(printed));
ok('print shows the local picture', printed.imgs.some((i) => i.alt === 'A local picture' && i.w === 4));
ok('print shows the web picture as its alt text', printed.web.includes('A chart from the web') && !printed.imgs.some((i) => i.alt === 'A chart from the web'));

// Export as HTML and Copy as Formatted Text carry the document's own paths, not what the screen shows
await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, D + '/export.html');
await send('exporthtml'); await p.waitForTimeout(800);
const exported = fs.existsSync(D + '/export.html') ? fs.readFileSync(D + '/export.html', 'utf8') : '';
ok('Export as HTML keeps the original picture paths', exported.includes('src="doc-images/pic%201.png"') && exported.includes('src="https://example.com/chart.png"') && !/file:|data:image|data-shown|img-web/.test(exported));
await send('copyrich'); await p.waitForTimeout(600);
// Electron 44's clipboard follows the W3C Clipboard API: read() gives ClipboardItems
const copied = await app.evaluate(async ({ clipboard }) => { for (const item of await clipboard.read()) if (item.types.includes('text/html')) return (await item.getType('text/html')).text(); return ''; });
// (when the async clipboard is unavailable the copy goes through the page selection, and Chromium then makes relative
// image URLs absolute; that is older behaviour. What matters here is that nothing of the on-screen display leaks.)
ok('Copy as Formatted Text carries the document\'s pictures, not the on-screen placeholders', copied.includes('doc-images/pic%201.png') && copied.includes('https://example.com/chart.png') && !/data:image|data-shown|img-web/.test(copied));
ok('showing pictures does not mark the document changed', !(await p.evaluate(() => document.querySelector('.tab.active').classList.contains('dirty'))));
await send('save'); await p.waitForTimeout(800);
ok('saving leaves the Markdown exactly as it was', fs.readFileSync(D + '/doc.md', 'utf8') === md);
ok('no page errors', errs.length === 0);
if (errs.length) console.log('  ' + errs.join('\n  '));
process.exit(0);
