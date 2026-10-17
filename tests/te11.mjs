// Electron: opening a recent document from Home fades and lifts the editor in (under 200 ms) from its very first
// frame, and with reduced motion it simply appears.
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'edith-reveal-'));
const files = ['north', 'south'].map((n) => { const f = path.join(D, n + '.md'); fs.writeFileSync(f, '# ' + n + '\n\n' + ('A plain line of filler text about the ' + n + ' side. ').repeat(30) + '\n'); return f; });
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.waitForTimeout(1500);
await p.setViewportSize({ width: 1300, height: 860 });
for (const f of files) { await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), f); await p.waitForTimeout(600); }
await p.keyboard.press('Meta+W'); await p.waitForTimeout(500); // south closes; north stays open
const home = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'home'));
// record the visible editor's opacity and offset on every frame from the click until it settles
const openCard = (f) => p.evaluate((f) => new Promise((res) => {
  const frames = []; const t0 = performance.now();
  const tick = () => {
    const v = !document.body.classList.contains('home') && document.querySelector('.tabview:not([hidden])');
    if (v) { const c = getComputedStyle(v); frames.push([Math.round(performance.now() - t0), +(+c.opacity).toFixed(2), c.transform]); }
    if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res({ frames, name: document.querySelector('.tab.active .n').textContent, anims: document.getAnimations().length });
  };
  requestAnimationFrame(tick);
  document.querySelector(`.rcard[title="${f}"]`).click();
}), f);
for (const [label, f, name] of [['a closed document', files[1], 'south.md'], ['a document already open in a tab', files[0], 'north.md']]) {
  await home(); await p.waitForTimeout(700);
  const r = await openCard(f);
  const shown = r.frames, first = shown[0] || [], last = shown[shown.length - 1] || [];
  const done = shown.find((x) => x[1] === 1 && x[2] === 'none');
  console.log('  ' + label + ':', JSON.stringify(shown.slice(0, 6)), '…');
  ok(`${label}: opens ${name}`, r.name === name);
  ok(`${label}: first visible frame starts faded and lowered`, first[1] < 0.6 && first[2] !== 'none');
  ok(`${label}: settles fully within 200 ms of appearing (${done ? done[0] - first[0] : '—'} ms)`, !!done && done[0] - first[0] <= 200);
  ok(`${label}: ends at rest`, last[1] === 1 && last[2] === 'none' && !(await p.evaluate(() => document.body.classList.contains('reveal'))));
}
await p.emulateMedia({ reducedMotion: 'reduce' });
await home(); await p.waitForTimeout(700);
const r = await openCard(files[1]);
ok('reduced motion: the editor appears at once, no animation', r.frames.length > 0 && r.frames.every((x) => x[1] === 1 && x[2] === 'none'));
console.log(errs.length ? 'FAIL page errors ' + errs.join('|') : 'PASS no page errors');
process.exit(0);
