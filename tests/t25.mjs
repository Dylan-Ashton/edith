// Theme fonts are loaded while idle after startup, so the first switch to a theme no longer draws in a fallback font
// and reflows when its fonts arrive, and the preload itself causes no long task.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.startTime))).observe({ type: 'longtask', buffered: true }); });
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const t0 = await p.evaluate(() => performance.now());
let pending = -1;
for (let i = 0; i < 80; i++) { pending = await p.evaluate(() => [...document.fonts].filter((f) => f.status !== 'loaded').length); if (!pending) break; await p.waitForTimeout(100); }
ok('every bundled font face is loaded soon after startup', pending === 0);
ok('no long task while the fonts load', (await p.evaluate((t) => window.__lt.filter((s) => s > t).length, t0)) === 0);
await p.evaluate(() => { window.__faces = 0; document.fonts.addEventListener('loadingdone', (e) => { window.__faces += e.fontfaces.length; }); });
for (const id of ['dusk', 'natural', 'organic', 'academic', 'focused', 'matrix', 'edith']) {
  const faces = await p.evaluate((id) => new Promise((res) => {
    window.__faces = 0; document.getElementById('btnTheme').click();
    [...document.querySelectorAll('#themeMenu button')].find((b) => b.textContent.toLowerCase().startsWith(id)).click();
    requestAnimationFrame(() => document.fonts.ready.then(() => requestAnimationFrame(() => res(window.__faces))));
  }), id);
  ok(`first switch to ${id} loads no fonts (${faces})`, faces === 0);
}
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
