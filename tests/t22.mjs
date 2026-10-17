// Status-bar zoom menu: each page width is visibly different (Wide sat on top of Full window at the default 1280 px
// window), the chosen width and text size are marked, and a preset shows its own number (115% used to read 113%).
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const errs = [];
const measure = (p) => p.evaluate(() => { const e = document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container .toastui-editor-contents'); const c = getComputedStyle(e); return Math.round(e.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight)); });
const marked = (p, attr) => p.evaluate((a) => [...document.querySelectorAll('#zoomMenu [' + a + '].on')].map((e) => e.getAttribute(a)).join(','), attr);
for (const [vw, theme] of [[1280, 'edith'], [1280, 'academic'], [1500, 'focused'], [1920, 'edith']]) {
  const p = await b.newPage({ viewport: { width: vw, height: 800 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
  await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  const w = {};
  for (const k of ['normal', 'wide', 'full']) {
    await p.click('#btnZoom'); await p.click(`#zoomMenu [data-width=${k}]`); await p.waitForTimeout(100);
    w[k] = await measure(p);
    await p.click('#btnZoom'); ok(`${vw}px ${theme}: ${k} is marked in the menu`, (await marked(p, 'data-width')) === k); await p.click('#btnZoom');
  }
  console.log(`  ${vw}px ${theme}: text column`, JSON.stringify(w));
  ok(`${vw}px ${theme}: Wide is visibly wider than Comfortable`, w.wide - w.normal >= 40);
  ok(`${vw}px ${theme}: Full window is visibly wider than Wide`, w.full - w.wide >= 40);
  await p.close();
}
// text size: each preset reads as itself on the button, in the menu and in Preferences
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
for (const z of ['80', '90', '100', '115', '130', '150']) {
  await p.click('#btnZoom'); await p.click(`#zoomMenu [data-zoom="${z}"]`);
  await p.click('#btnZoom');
  ok(`${z}% preset: button, menu and mark agree`, (await p.textContent('#btnZoom')) === z + '%' && (await p.textContent('#zoomVal')) === z + '%' && (await marked(p, 'data-zoom')) === z);
  await p.click('#btnZoom');
}
await p.click('#btnZoom'); await p.click('#zoomMenu [data-zoom="100"]');
await p.click('#btnZoom'); await p.click('#btnBigger');
ok('one step bigger: no preset marked, button shows the real size', (await marked(p, 'data-zoom')) === '' && (await p.textContent('#btnZoom')) === '106%');
await p.click('#btnBigger');
ok('two steps bigger lands on the 115% preset', (await marked(p, 'data-zoom')) === '115' && (await p.textContent('#btnZoom')) === '115%');
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
