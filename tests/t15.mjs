// Find bar: typing stays in the search box; Home closes it; tabs don't drift; hover feedback.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const doc = () => p.evaluate(() => [...document.querySelectorAll('.tabview:not([hidden]) .ProseMirror')].find(e => e.offsetParent).innerText);
for (const mode of ['ww', 'md']) {
  if (mode === 'md') await p.keyboard.press('Meta+Shift+2'); await p.waitForTimeout(300);
  await p.click('.tabview:not([hidden]) .ProseMirror:visible'); await p.keyboard.type('apple banana apple cherry'); await p.waitForTimeout(300);
  const before = await doc();
  await p.keyboard.press('Meta+F'); await p.waitForTimeout(200);
  await p.keyboard.type('apple', { delay: 40 }); await p.waitForTimeout(300);
  ok(mode + ' typed text lands in search box', await p.inputValue('#findQ') === 'apple');
  ok(mode + ' document unchanged', (await doc()) === before);
  ok(mode + ' focus still in search box', await p.evaluate(() => document.activeElement.id === 'findQ'));
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok(mode + ' Enter does not edit document', (await doc()) === before);
  await p.fill('#findR', 'pear'); await p.click('#replOne'); await p.waitForTimeout(400);
  ok(mode + ' replace one works', /pear/.test(await doc()) && (await doc()).split('apple').length === 2);
  await p.click('#replAll'); await p.waitForTimeout(300);
  ok(mode + ' replace all works', !/apple/.test(await doc()));
  await p.click('#findClose'); await p.keyboard.press('Meta+Z'); await p.keyboard.press('Meta+A'); await p.keyboard.press('Backspace'); await p.waitForTimeout(200);
}
await p.keyboard.press('Meta+F'); await p.waitForTimeout(150);
ok('find bar open', await p.evaluate(() => document.getElementById('findbar').classList.contains('on')));
await p.click('#btnHome'); await p.waitForTimeout(300);
ok('Home closes find bar', await p.evaluate(() => !document.getElementById('findbar').classList.contains('on')));
await p.keyboard.press('Meta+F'); await p.waitForTimeout(150);
ok('⌘F ignored on Home', await p.evaluate(() => !document.getElementById('findbar').classList.contains('on')));
await p.click('#btnHome');
for (let i = 0; i < 12; i++) { await p.keyboard.press('Meta+T'); }
await p.waitForTimeout(400);
const geo = () => p.evaluate(() => { const s = document.getElementById('tabsScroll'); const t = [...s.querySelectorAll('.tab')].map(x => Math.round(x.getBoundingClientRect().top)); return { top: s.scrollTop, tops: [...new Set(t)] }; });
let g = await geo(); ok('tabs share one top, no vertical scroll ' + JSON.stringify(g), g.top === 0 && g.tops.length === 1);
await p.evaluate(() => { const s = document.getElementById('tabsScroll'); s.scrollTop = 5; });
console.log(await p.evaluate(() => { const t=document.querySelector('.tab'); const r=t.getBoundingClientRect(); return JSON.stringify({r:[r.x,r.y,r.width,r.height], home:document.body.classList.contains('home'), vis:getComputedStyle(t).visibility+getComputedStyle(t).display}); }));
await p.click('.tab >> nth=0', {timeout:3000}).catch(e=>console.log('click failed')); await p.waitForTimeout(200); g = await geo(); ok('vertical drift self-corrects', g.top === 0 && g.tops.length === 1);
const bg = (await p.evaluate(() => getComputedStyle(document.querySelector('.tab:not(.active)')).backgroundColor));
await p.hover('.tab:not(.active) >> nth=0'); await p.waitForTimeout(350);
const bg2 = (await p.evaluate(() => getComputedStyle(document.querySelector('.tab:not(.active)')).backgroundColor)); // first inactive tab
ok('hover changes tab background ' + bg + ' -> ' + bg2, bg !== bg2);
await p.evaluate(() => localStorage.clear()); const p2 = await b.newPage({ viewport: { width: 1400, height: 900 } }); await p2.goto('file://' + process.cwd() + '/dist.html'); await p2.waitForTimeout(1200);
ok('drag region: empty tab strip & spacer are draggable', await p2.evaluate(() => { const rg = (el) => getComputedStyle(el).getPropertyValue('-webkit-app-region'); const st = document.getElementById('tabstrip'); const r = st.getBoundingClientRect(); const el = document.elementFromPoint(r.right - 40, r.top + 20); const sp = document.querySelector('#topbar .spacer'); return rg(st) === 'drag' && rg(el) !== 'no-drag' && rg(document.getElementById('btnHome')) === 'no-drag' && rg(document.querySelector('.tab') || document.getElementById('tabAdd')) === 'no-drag' && (!sp || rg(sp) !== 'no-drag'); }));
console.log(errs.join('\n') || 'no page errors');
await b.close();
