// v3.7.1: Write/Markdown switch must not blink or bounce. The Markdown preview must not jump between positions across frames.
import { chromium } from 'playwright';
const b = await chromium.launch(); const ctxb = await b.newContext({ viewport: { width: 1400, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctxb.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(800);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const long = '# Title\n\n' + Array.from({ length: 80 }, (_, i) => `Paragraph ${i} with some words to make the line wrap across the page width for the test.`).join('\n\n') + '\n';
await p.evaluate((t) => navigator.clipboard.writeText(t), long);
await p.evaluate(() => document.getElementById('btnHome').click()); await p.waitForTimeout(300);
await p.click('#startScratch'); await p.waitForTimeout(700);
await p.mouse.move(600, 400); await p.mouse.wheel(0, 1500); await p.waitForTimeout(600);
// Sample every frame after a click, with the mask forced visible so any intermediate position shows.
await p.addStyleTag({ content: '.mode-swap{opacity:1 !important}' });
const frames = (m) => p.evaluate(async (m) => {
  const v = () => document.querySelector('.tabview:not([hidden])'); const rows = [];
  const snap = () => { const e = v(); const pr = e.querySelector('.toastui-editor-md-preview'); return { prev: pr ? pr.scrollTop | 0 : null, cls: e.className.includes('mode-swap') }; };
  document.querySelector('[data-mode=' + m + ']').click(); rows.push(snap());
  for (let i = 0; i < 40; i++) { await new Promise((r) => requestAnimationFrame(() => r())); rows.push(snap()); }
  return rows;
}, m);
const md = (await frames('markdown')).filter((r) => r.prev !== null);
await p.waitForTimeout(900);
const distinct = [...new Set(md.map((r) => r.prev))];
ok('preview holds one position after switching to Markdown (no bounce)', distinct.length === 1 || (distinct.length === 2 && distinct.includes(0)));
ok('preview sits near the reading position, not at the caret', distinct.every((x) => x < 2000));
await p.waitForTimeout(800);
ok('no page errors', errs.length === 0);
await b.close();
