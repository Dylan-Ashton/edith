// Home: each recent card has a remove button that shows on hover or keyboard focus, is labelled, removes the entry
// from Recent only (fading out in about 180 ms, or at once with reduced motion), and moves focus to the next card.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const errs = [];
for (const motion of ['no-preference', 'reduce']) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: motion })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
  // eight synthetic entries, newest first: doc-1 … doc-8
  await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('mdeditor'); r.onsuccess = () => { const tx = r.result.transaction('recent', 'readwrite'); for (let i = 1; i <= 8; i++) tx.objectStore('recent').put({ name: 'doc-' + i + '.md', label: 'doc-' + i + '.md', handle: null, path: null, at: Date.now() - i * 60000 }); tx.oncomplete = res; }; }));
  await p.click('#btnHome'); await p.waitForTimeout(400);
  const names = () => p.evaluate(() => [...document.querySelectorAll('#startRecent .rcard .n')].map((n) => n.textContent).join(','));
  const stored = () => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('mdeditor'); r.onsuccess = () => { const q = r.result.transaction('recent').objectStore('recent').getAllKeys(); q.onsuccess = () => res(q.result.length); }; }));
  const xOpacity = (i) => p.evaluate((i) => getComputedStyle(document.querySelectorAll('#startRecent .rcard-x')[i]).opacity, i);
  const m = motion === 'reduce' ? ' (reduced motion)' : '';
  ok('six cards' + m, (await names()) === 'doc-1,doc-2,doc-3,doc-4,doc-5,doc-6');
  await p.mouse.move(5, 5); await p.waitForTimeout(200);
  ok('remove button hidden until hover' + m, (await xOpacity(1)) === '0');
  await p.hover('#startRecent .rcard-wrap:nth-child(2)'); await p.waitForTimeout(200);
  ok('remove button shows on hover' + m, (await xOpacity(1)) === '1');
  const x = p.locator('#startRecent .rcard-wrap:nth-child(2) .rcard-x');
  ok('tooltip and accessible label' + m, (await x.getAttribute('title')) === 'Remove from Recent' && (await x.getAttribute('aria-label')) === 'Remove doc-2 from Recent');
  if (motion === 'no-preference') {
    await x.click(); await p.waitForTimeout(70);
    const mid = await p.evaluate(() => { const w = [...document.querySelectorAll('#startRecent .rcard-wrap')].find((e) => e.dataset.key === 'doc-2.md'); return w ? +getComputedStyle(w).opacity : -1; });
    ok('card fades out rather than vanishing (' + mid.toFixed(2) + ' at 70 ms)', mid > 0 && mid < 1);
    await p.waitForTimeout(450);
  } else {
    await x.click(); await p.waitForTimeout(60);
    ok('card goes at once with reduced motion', !(await names()).includes('doc-2'));
    ok('nothing animates with reduced motion', (await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)) === 0);
  }
  ok('doc-2 removed, doc-7 moves up into view' + m, (await names()) === 'doc-1,doc-3,doc-4,doc-5,doc-6,doc-7');
  ok('removed from the Recent store only' + m, (await stored()) === 7);
  // keyboard: Tab onto a card shows its button; Tab again reaches the button; Enter removes; focus moves to the next card
  await p.mouse.move(5, 5);
  await p.focus('#startRecent .rcard-wrap:nth-child(1) .rcard'); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(200);
  ok('remove button shows on keyboard focus' + m, (await xOpacity(0)) === '1');
  await p.keyboard.press('Tab');
  ok('remove button is reachable by Tab' + m, await p.evaluate(() => document.activeElement.classList.contains('rcard-x')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok('Enter removes doc-1' + m, (await names()) === 'doc-3,doc-4,doc-5,doc-6,doc-7,doc-8');
  ok('focus moves to the next card' + m, await p.evaluate(() => document.activeElement.classList.contains('rcard') && document.activeElement.querySelector('.n').textContent === 'doc-3'));
  await p.close();
}
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
