// The website's try-it demo: scripts/site.sh builds _site/ with the app at demo/; the site offers "Try it in your
// browser" on computers once demo/ exists; the demo shows its bar, opens on the welcome document, edits, and makes
// no request beyond its own page. The app itself never shows the demo bar.
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const r = spawnSync('bash', ['scripts/site.sh'], { encoding: 'utf8' });
ok('scripts/site.sh builds the site', r.status === 0 && fs.existsSync('_site/demo/index.html') && fs.existsSync('_site/index.html'));
const types = { '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.woff': 'font/woff', '.mp4': 'video/mp4' };
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
const tryShown = async (ctxOpts, url) => { const c = await b.newContext(ctxOpts); const p = await c.newPage(); await p.goto(url); await p.waitForTimeout(700); const v = await p.isVisible('#tryDemo'); await c.close(); return v; };
ok('site offers the demo on a computer', await tryShown({ viewport: { width: 1280, height: 800 } }, base));
ok('site does not offer it on a phone', !(await tryShown({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, base)));
ok('site does not offer it while demo/ is not deployed', !(await tryShown({ viewport: { width: 1280, height: 800 } }, `http://127.0.0.1:${bare.address().port}/`)));
// the demo itself
const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(base); await p.waitForTimeout(700);
const reqs = []; p.on('request', (q) => reqs.push(q.url()));
await p.click('#tryDemo'); await p.waitForURL(base + 'demo/'); await p.waitForTimeout(1500);
ok('demo shows the browser bar', await p.isVisible('.demo-bar'));
ok('demo bar links to the download', (await p.getAttribute('.demo-bar a', 'href')) === '../#download');
ok('demo opens on the welcome document', /Welcome to Edith/.test(await p.textContent('.tabview:not([hidden]) .ProseMirror h1')));
await p.click('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror h1'); await p.keyboard.press('End'); await p.keyboard.type(' (demo)'); await p.waitForTimeout(700);
ok('demo edits', /Welcome to Edith \(demo\)/.test(await p.textContent('.tabview:not([hidden]) .ProseMirror h1')));
const other = reqs.filter((u) => !/^(data|blob):/.test(u) && u !== base + 'demo/');
ok('demo makes no request beyond its own page' + (other.length ? ' ' + other.join(' ') : ''), other.length === 0);
await p.click('.demo-bar a'); await p.waitForURL(base + '#download');
ok('the link goes back to the download section', p.url() === base + '#download');
// the app (Mac app and plain dist.html) never shows the bar
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(800);
ok('the app itself has no demo bar', !(await p.isVisible('.demo-bar')));
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close(); site.close(); bare.close();
