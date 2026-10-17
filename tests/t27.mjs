// The website's "Try it" window (docs/index.html #try, site/try.js): scripts/site.sh builds it; the page shows a
// read-only example that turns into Edith's editor near the screen without changing what is shown; toolbar,
// typing shortcuts, checkboxes, links and Start over update the Markdown pane; nothing is requested from elsewhere;
// without the bundle (docs/ served as is) the example stays and nothing breaks; on a phone the toolbar fits.
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const r = spawnSync('bash', ['scripts/site.sh'], { encoding: 'utf8' });
ok('scripts/site.sh builds the site and the editor bundle', r.status === 0 && fs.existsSync('_site/assets/try.js') && fs.existsSync('_site/assets/try.css'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff': 'font/woff' };
const serve = (root) => new Promise((res) => {
  const s = http.createServer((q, a) => {
    let f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f.startsWith(path.resolve(root)) || !fs.existsSync(f)) { a.writeHead(404); return a.end(); }
    a.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); a.end(q.method === 'HEAD' ? undefined : fs.readFileSync(f));
  }).listen(0, '127.0.0.1', () => res(s));
});
const site = await serve(path.resolve('_site')), bare = await serve(path.resolve('docs'));
const base = `http://127.0.0.1:${site.address().port}/`;
const b = await chromium.launch(); const errs = [];
// reduced motion: the site scrolls smoothly otherwise, and the mouse would click a moving page
const c = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
const reqs = []; p.on('request', (q) => reqs.push(q.url()));
await p.goto(base); await p.waitForTimeout(500);
const md = () => p.textContent('#try .try-md pre');
const staticMd = await md(), staticDoc = await p.textContent('#try .try-doc');
ok('the example is there before the editor loads', /Weekend plan/.test(staticDoc) && /^# Weekend plan\n/.test(staticMd) && !(await p.evaluate(() => document.getElementById('try').classList.contains('live'))));
ok('the editor is not loaded at the top of the page', !reqs.some((u) => u.includes('assets/try.')));
await p.evaluate(() => document.getElementById('try').scrollIntoView({ block: 'center' }));
for (let i = 0; i < 40 && !(await p.evaluate(() => document.getElementById('try').classList.contains('live'))); i++) await p.waitForTimeout(100);
ok('the window becomes live near the screen', await p.evaluate(() => document.getElementById('try').classList.contains('live')));
ok('going live changes neither side', (await md()) === staticMd && (await p.textContent('#try .try-doc')).replace(/\s+/g, ' ').includes('Weekend plan Write here like any document'));
const pm = '#try .toastui-editor-ww-container .ProseMirror';
// put the caret after `text`, or select it, the way a person does: with the mouse
const place = async (text, atEnd) => {
  const r = await p.evaluate(([s, t]) => { const root = document.querySelector(s); const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf(t); if (i >= 0) { n.parentElement.scrollIntoView({ block: 'center' }); const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const a = rg.getBoundingClientRect(); rg.setStart(n, i + t.length - 1); rg.setEnd(n, i + t.length); const z = rg.getBoundingClientRect(); return { x1: a.left + 1, x2: z.right - 0.5, y1: a.top + a.height / 2, y2: z.top + z.height / 2 }; } } return null; }, [pm, text]);
  if (!r) return false;
  if (atEnd) await p.mouse.click(r.x2, r.y2);
  else { await p.mouse.move(r.x1, r.y1); await p.mouse.down(); await p.mouse.move(r.x2, r.y2, { steps: 4 }); await p.mouse.up(); }
  await p.waitForTimeout(60);
  return true;
};
// typing
await place('for a heading.', true); await p.keyboard.type(' Hello there');
await p.waitForTimeout(100);
ok('typing shows up in the Markdown', (await md()).includes('for a heading. Hello there'));
// bold from the toolbar, and the button shows it
await place('Hello'); await p.click('#try [data-cmd=bold]'); await p.waitForTimeout(100);
ok('Bold wraps the selection in **', (await md()).includes('**Hello** there'));
ok('Bold shows as on', (await p.getAttribute('#try [data-cmd=bold]', 'aria-pressed')) === 'true');
// typing shortcut for a heading
await place(' there', true); await p.keyboard.press('Enter'); await p.keyboard.type('## Notes'); await p.waitForTimeout(100);
ok('"## " starts a heading, as in Edith', /\n## Notes\n/.test(await md()) && (await p.inputValue('#try select')) === '2');
// paragraph style menu
await place('Notes', true); await p.selectOption('#try select', '0'); await p.waitForTimeout(100);
ok('Normal text turns the heading back into a paragraph', /\nNotes\n/.test(await md()) && !/## Notes/.test(await md()));
// a checkbox click
const box = await p.evaluate(() => { const li = [...document.querySelectorAll('#try .ProseMirror li.task-list-item')].find((l) => l.textContent.trim() === 'Charger'); const r = li.getBoundingClientRect(); return { x: r.left + 8, y: r.top + 12 }; });
await p.mouse.click(box.x, box.y); await p.waitForTimeout(100);
ok('clicking a checkbox ticks it in the Markdown', (await md()).includes('- [x] Charger'));
// a link through the small field
await place('old harbor'); await p.click('#try [data-cmd=link]');
ok('Link opens the address field', await p.isVisible('#try .try-link input'));
await p.fill('#try .try-link input', 'example.org/harbor'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
ok('the link lands in the Markdown', (await md()).includes('[old harbor](https://example.org/harbor)') && !(await p.isVisible('#try .try-link')));
// lists from the toolbar
await place('Nothing you type here', true); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
await p.keyboard.type('first'); await p.click('#try [data-cmd=orderedList]'); await p.waitForTimeout(100);
ok('Numbered list from the toolbar', /\n1\. first\n/.test(await md()));
// start over
await p.click('#try .try-reset'); await p.waitForTimeout(150);
ok('Start over puts the example back', (await md()) === staticMd);
const other = reqs.filter((u) => !u.startsWith(base) && !/^(data|blob):/.test(u));
ok('nothing is requested from anywhere else' + (other.length ? ' ' + other.join(' ') : ''), other.length === 0);
// docs/ served without the bundle (e.g. Pages not deploying from Actions): the example stays, no errors
const p2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p2.on('pageerror', (e) => errs.push(e.message));
await p2.goto(`http://127.0.0.1:${bare.address().port}/#features`); await p2.waitForTimeout(1200);
ok('without the bundle the example still shows', /Weekend plan/.test(await p2.textContent('#try .try-doc')) && !(await p2.evaluate(() => document.getElementById('try').classList.contains('live'))));
// phone: every control is reachable without sideways scrolling
const p3 = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); p3.on('pageerror', (e) => errs.push(e.message));
await p3.goto(base + '#features'); await p3.waitForTimeout(1500);
ok('on a phone the toolbar fits', await p3.evaluate(() => [...document.querySelectorAll('#try .try-bar > button, #try .try-bar > select')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })));
ok('on a phone the page does not scroll sideways', await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close(); site.close(); bare.close();
