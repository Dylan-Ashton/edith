// Tab hover: every tab shows a hover state in every theme, in a document and on Home (the open tab had a 3% tint, and
// none on Home). With reduced motion the hover does not move the tab.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300); // two tabs: one open, one not
const look = (s) => p.evaluate((sel) => { const c = getComputedStyle(document.querySelector(sel)); return { bg: c.backgroundColor, shadow: c.boxShadow, transform: c.transform }; }, s);
// relative luminance of a computed colour (rgb(), rgba() or color(srgb …)), composited over the tab strip
const lum = (str, under) => p.evaluate(([s, u]) => { const cv = document.createElement('canvas').getContext('2d'); const px = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = u; cv.fillRect(0, 0, 1, 1); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return cv.getImageData(0, 0, 1, 1).data; }; const d = px(s); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]); }, [str, under]);
const ratio = (a, c) => (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
for (const th of ['edith', 'dusk', 'natural', 'organic', 'academic', 'focused', 'matrix']) {
  await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, th);
  for (const home of [false, true]) {
    if (home) { await p.click('#btnHome'); await p.waitForTimeout(150); }
    const strip = await p.evaluate(() => getComputedStyle(document.getElementById('tabstrip')).backgroundColor);
    const where = th + (home ? ' on Home' : ' in a document');
    for (const [name, sel] of [['open tab', '.tab.active'], ['other tab', '.tab:not(.active)'], ['Home button', '#btnHome']]) {
      await p.mouse.move(640, 500); await p.waitForTimeout(30); const a = await look(sel);
      await p.hover(sel); await p.waitForTimeout(30); const h = await look(sel);
      const tint = ratio(await lum(a.bg, strip), await lum(h.bg, strip));
      const line = a.shadow !== h.shadow && h.shadow !== 'none';
      ok(`${where}: ${name} shows a hover (contrast ${tint.toFixed(2)}${line ? ', accent line' : ''})`, tint >= 1.05 || line);
      ok(`${where}: ${name} hover stays subtle`, tint < 1.6);
      if (name === 'other tab') ok(`${where}: hover does not move the tab with reduced motion`, h.transform === 'none');
    }
    if (home) { await p.click('.tab.active'); await p.waitForTimeout(150); }
  }
}
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
