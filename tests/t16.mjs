// Home has no note bubble; revision prompt compiles open notes; scratch mode (paste, edit, copy, close without prompt).
import { chromium } from 'playwright';
const b = await chromium.launch(); const ctxb = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctxb.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const clip = () => p.evaluate(() => navigator.clipboard.readText());

// 1. Home: selecting text must not offer a note
await p.click('#btnHome'); await p.waitForTimeout(300);
await p.evaluate(() => { const h = document.getElementById('startGreeting'); const r = document.createRange(); r.selectNodeContents(h); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
await p.mouse.move(600, 300); await p.evaluate(() => document.getElementById('start').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
await p.waitForTimeout(100);
ok('no note bubble on Home', await p.evaluate(() => document.getElementById('noteBubble').hidden));

// 2. Scratch from clipboard
await p.evaluate(() => navigator.clipboard.writeText('# Act 2\n\n* the twist\n* the fallout\n\nThe hero betrays the mentor.\n'));
await p.click('#startScratch'); await p.waitForTimeout(600);
ok('scratch tab opened', await p.evaluate(() => document.querySelector('.tab.active .n').textContent === 'scratch.md'));
ok('Copy Markdown button visible', await p.evaluate(() => !document.getElementById('btnCopyScratch').hidden));
ok('pasted markdown rendered', await p.evaluate(() => !!document.querySelector('.tabview:not([hidden]) .ProseMirror h1')));
ok('not dirty after paste', await p.evaluate(() => !document.querySelector('.tab.active').classList.contains('dirty')));

// 3. Notes -> revision prompt
const sel = async (txt) => p.evaluate((t) => { const pm = [...document.querySelectorAll('.tabview:not([hidden]) .ProseMirror')].find(e => e.offsetParent); const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf(t); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } } return false; }, txt);
ok('selected passage', await sel('The hero betrays the mentor.'));
await p.keyboard.press('Meta+Shift+M'); await p.waitForTimeout(200);
await p.fill('#noteText', 'This contradicts the act 2 twist.'); await p.click('#noteSave'); await p.waitForTimeout(300);
await p.keyboard.press('Meta+Shift+R'); await p.waitForTimeout(300);
const prompt = await clip(); console.log(prompt);
ok('prompt has quote', prompt.includes('"The hero betrays the mentor."'));
ok('prompt has note', prompt.includes('This contradicts the act 2 twist.'));
ok('prompt has section', prompt.includes('Under "Act 2"'));

// 4. Copy Markdown from scratch
await p.click('#btnCopyScratch'); await p.waitForTimeout(300);
const md = await clip(); ok('copied clean markdown', /^# Act 2/.test(md) && !md.includes('mdnotes'));

// 5. Close scratch after editing: no prompt
await p.click('.tabview:not([hidden]) .ProseMirror:visible'); await p.keyboard.type('x'); await p.waitForTimeout(700);
ok('edit makes it dirty', await p.evaluate(() => document.querySelector('.tab.active').classList.contains('dirty')));
await p.keyboard.press('Meta+W'); await p.waitForTimeout(500);

ok('closed with no unsaved prompt', await p.evaluate(() => !document.querySelector('.modal.on') && document.querySelectorAll('.tab').length === 1 && document.querySelector('.tab .n').textContent !== 'scratch.md'));
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
