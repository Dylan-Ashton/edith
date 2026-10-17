// Electron: the x on a recent card removes it from Home and from File → Open Recent, leaves the file untouched, and
// gives up Edith's access to the file unless a tab still has it open.
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'edith-recent-'));
const files = ['alpha', 'beta', 'gamma'].map((n) => { const f = path.join(D, n + '.md'); fs.writeFileSync(f, '# ' + n + ' notes\n\nA short paragraph about ' + n + '.\n'); return f; });
const [fa, fb, fc] = files;
const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath });
const p = await app.firstWindow(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.waitForTimeout(1500);
await p.setViewportSize({ width: 1400, height: 900 });
for (const f of files) { await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), f); await p.waitForTimeout(600); }
// close gamma's tab (the active one); alpha and beta stay open
await p.keyboard.press('Meta+W'); await p.waitForTimeout(500);
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'home')); await p.waitForTimeout(800);
const openRecent = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find((i) => i.label === 'File').submenu.items.find((i) => i.label === 'Open Recent').submenu.items.map((i) => i.label));
const allowedList = () => JSON.parse(fs.readFileSync(path.join(process.env.EDITH_TEST_USER_DATA, 'allowed-files.json'), 'utf8')).files;
const card = (f) => `.rcard-wrap:has(.rcard[title="${f}"])`;
ok('Open Recent lists gamma first', (await openRecent())[0] === 'gamma.md');
ok('gamma is allowed before', allowedList().includes(fc));
// remove gamma (no tab has it open)
await p.hover(card(fc)); await p.waitForTimeout(200);
await p.click(card(fc) + ' .rcard-x'); await p.waitForTimeout(700);
ok('gamma card is gone from Home', (await p.locator(card(fc)).count()) === 0);
ok('gamma is gone from Open Recent', !(await openRecent()).includes('gamma.md'));
ok('gamma is no longer readable by the page', (await p.evaluate((f) => window.native.readFile(f), fc)).denied === true);
ok('gamma is gone from allowed-files.json', !allowedList().includes(fc));
ok('gamma itself is untouched', fs.readFileSync(fc, 'utf8') === '# gamma notes\n\nA short paragraph about gamma.\n');
// remove alpha, which is still open in a tab: off Recent, but its tab keeps working
await p.hover(card(fa)); await p.waitForTimeout(200);
await p.click(card(fa) + ' .rcard-x'); await p.waitForTimeout(700);
ok('alpha card is gone from Home', (await p.locator(card(fa)).count()) === 0);
ok('alpha is gone from Open Recent', !(await openRecent()).includes('alpha.md'));
ok('alpha stays readable while its tab is open', (await p.evaluate((f) => window.native.readFile(f), fa)).ok === true);
ok('beta is still on Recent', (await p.locator(card(fb)).count()) === 1 && (await openRecent()).includes('beta.md'));
ok('all three files still exist', files.every((f) => fs.existsSync(f)));
console.log(errs.length ? 'FAIL page errors ' + errs.join('|') : 'PASS no page errors');
process.exit(0);
