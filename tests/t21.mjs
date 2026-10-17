// Browser build: no network requests at all (fonts are bundled), the Content-Security-Policy does not break
// Word and PDF import, and every theme's fonts come from the page itself.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
const errs = [], net = [], csp = [];
p.on('pageerror', (e) => errs.push(e.message));
// anything that would leave the machine reaches the route layer; CSP-blocked attempts never do
await p.route('**/*', (route) => { const u = route.request().url(); if (/^(file|data|blob|about):/.test(u)) return route.continue(); net.push(u); return route.abort(); });
p.on('console', (m) => { if (/Content Security Policy/.test(m.text())) csp.push(m.text().slice(0, 160)); });
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);

ok('no Google Fonts link left', (await p.locator('link[href*="fonts.googleapis"]').count()) === 0);
await p.evaluate(() => document.fonts.ready);
ok('IBM Plex Sans and Mono are bundled', await p.evaluate(() => document.fonts.check('16px "IBM Plex Sans"') && document.fonts.check('16px "IBM Plex Mono"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'IBM Plex Sans' && f.status === 'loaded')));
ok('font license ships inside the page', await p.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent.includes('SIL OPEN FONT LICENSE Version 1.1'))));

const theme = async (id) => { await p.evaluate((id) => { document.documentElement.dataset.theme = id; }, id); await p.evaluate(() => document.fonts.ready); };
for (const [id, fam] of [['natural', 'Lora'], ['organic', 'Fraunces'], ['academic', 'EB Garamond'], ['focused', 'Inter'], ['matrix', 'Share Tech Mono']]) {
  await theme(id);
  ok('theme ' + id + ' gets ' + fam + ' from the bundle', await p.evaluate((fam) => document.fonts.check('16px "' + fam + '"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === fam), fam));
}
await theme('edith');

const body = () => p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-contents').innerText);
await p.setInputFiles('#fileInput', 'tests/fixtures/test.docx'); await p.waitForTimeout(2000);
const docx = await body();
ok('Word import works under the CSP', /Operations Manual/.test(docx) && /Col A/.test(docx));
await p.setInputFiles('#fileInput', 'tests/fixtures/test.pdf'); await p.waitForTimeout(2500);
ok('PDF import works under the CSP', /Community Garden Overview/.test(await body()));
// print builds a srcdoc iframe; it must load under frame-src 'none'
const printable = await p.evaluate(async () => { const fr = document.createElement('iframe'); document.body.appendChild(fr); fr.srcdoc = '<p id="x">x</p>'; await new Promise((r) => (fr.onload = r)); const okk = !!fr.contentDocument.getElementById('x'); fr.remove(); return okk; });
ok('print frame loads under the CSP', printable);

// a picture linked from the web is never requested and shows its alt text quietly instead of a broken image
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300);
await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '## Before\n\n![Revenue chart](https://example.com/chart.png)\n\nAfter.\n'); document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
await p.waitForTimeout(600);
const webImg = await p.evaluate(() => { const i = document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container img[alt="Revenue chart"]'); return i && { cls: i.className, src: i.getAttribute('src').slice(0, 30), w: i.naturalWidth }; });
ok('web picture shows a placeholder with its alt text', !!webImg && /img-web/.test(webImg.cls) && webImg.src.startsWith('data:image/svg+xml') && webImg.w > 0);
const md = await p.evaluate(() => { document.querySelector('[data-mode=markdown]').click(); return new Promise((r) => setTimeout(() => r(document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText), 400)); });
ok('...and the Markdown keeps its web address', md.includes('![Revenue chart](https://example.com/chart.png)'));
ok('no network requests', net.length === 0);
if (net.length) console.log('  requests:', net.join(' '));
// the web picture's own blocked attempt is expected; nothing else may be refused
const unexpected = csp.filter((l) => !l.includes("Refused to load the image 'https://example.com/chart.png'"));
ok('no other CSP violations during normal use', unexpected.length === 0);
if (unexpected.length) console.log('  ' + unexpected.join('\n  '));
ok('no page errors', errs.length === 0);
if (errs.length) console.log('  ' + errs.join('\n  '));
await b.close();
