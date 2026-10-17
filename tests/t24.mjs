// Write <-> Markdown on generated documents of about 1,000, 14,000 and 50,000 words: the outline and the text survive
// the round trip, closing the tab straight after a switch is clean, and the switch times are printed (no thresholds:
// CI machines vary too much).
import { chromium } from 'playwright';
import { filler } from './filler.mjs';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const errs = [];
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
// time from the click until the editor is shown again (the swap hides it while it lays out) and a frame is drawn
const sw = (mode) => p.evaluate((mode) => new Promise((res) => {
  const el = document.querySelector('.tabview:not([hidden])'); const t0 = performance.now();
  document.querySelector(`[data-mode=${mode}]`).click();
  const done = () => requestAnimationFrame(() => setTimeout(() => res(Math.round(performance.now() - t0))));
  if (!el.classList.contains('mode-swap')) return done();
  const mo = new MutationObserver(() => { if (!el.classList.contains('mode-swap')) { mo.disconnect(); done(); } }); mo.observe(el, { attributes: true });
}), mode);
const outline = () => p.evaluate(() => [...document.querySelectorAll('#panel-outline .ol-item')].map((b) => b.textContent));
const mdText = () => p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText);
for (const words of [1000, 14000, 50000]) {
  const md = filler(words), heads = md.split('\n').filter((l) => /^#{1,6} /.test(l)).length;
  await p.setInputFiles('#fileInput', { name: `filler-${words}.md`, mimeType: 'text/markdown', buffer: Buffer.from(md) });
  for (let i = 0; i < 40 && (await outline()).length !== heads; i++) await p.waitForTimeout(250);
  await p.waitForTimeout(500);
  const count = await p.textContent('#stWords');
  ok(`${words}: opened with ${count} and ${heads} headings in the outline`, (await outline()).length === heads);
  const before = await outline(), toMd = await sw('markdown'); await p.waitForTimeout(800);
  ok(`${words}: outline unchanged in Markdown`, JSON.stringify(await outline()) === JSON.stringify(before));
  const text1 = await mdText();
  const toWw = await sw('wysiwyg'); await p.waitForTimeout(800);
  ok(`${words}: outline unchanged back in Write`, JSON.stringify(await outline()) === JSON.stringify(before));
  const toMd2 = await sw('markdown'); await p.waitForTimeout(800);
  ok(`${words}: Markdown text is the same after a round trip`, (await mdText()) === text1);
  // close the tab straight after a switch: the change it triggers is still pending (up to 1.8 s on long documents)
  // and must not run once the tab is gone
  await sw('wysiwyg'); await p.keyboard.press('Meta+W'); await p.waitForTimeout(2500);
  console.log(`  ${count}: Write -> Markdown ${toMd} ms, ${toMd2} ms; Markdown -> Write ${toWw} ms`);
  ok(`${words}: closing right after a switch leaves nothing running`, errs.length === 0);
}
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
