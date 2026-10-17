// v3.7: undo reaches note deletes/resolves in order; Home hides indent buttons; mode switch masks flicker; notes bar
import { chromium } from 'playwright';
const b = await chromium.launch(); const ctxb = await b.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctxb.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const vis = (id) => p.evaluate((id) => { const e = document.getElementById(id); return !!(e && e.offsetParent); }, id);
await p.evaluate(() => document.getElementById('btnHome').click()); await p.waitForTimeout(300);
ok('Home hides the indent buttons', !(await vis('btnIndent')) && !(await vis('btnOutdent')));
await p.evaluate(() => navigator.clipboard.writeText('# T\n\nAlpha paragraph here.\n\nBeta paragraph here.\n')); await p.click('#startScratch'); await p.waitForTimeout(500);
ok('indent buttons appear in a document', await vis('btnIndent'));
const ww = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
const sel = (txt) => p.evaluate(([a, ww]) => { const pm = document.querySelector(ww); const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf(a); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + a.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } } return false; }, [txt, ww]);
const addNote = async (t) => { await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(150); await p.fill('#noteText', t); await p.click('#noteSave'); await p.waitForTimeout(300); };
const cards = () => p.evaluate(() => [...document.querySelectorAll('.note-card')].map((c) => c.textContent.replace(/\s+/g, ' ')));
await p.click(ww); await sel('Alpha'); await addNote('first note'); await sel('Beta'); await addNote('second note');
ok('kind row hidden until asked', !(await vis('kindRow')));
await p.evaluate(() => [...document.querySelectorAll('.note-card')].find((c) => /second/.test(c.textContent)).querySelector('[data-a=del]').click()); await p.waitForTimeout(500);
await p.click(ww); await p.keyboard.press('End'); await p.keyboard.type(' typed');
await p.evaluate(() => [...document.querySelectorAll('.note-card')].find((c) => /first/.test(c.textContent)).querySelector('[data-a=done]').click()); await p.waitForTimeout(300);
await p.click(ww); await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
let c = (await cards()).join('|'); const t1 = await p.evaluate((ww) => document.querySelector(ww).innerText, ww);
ok('1st undo reopens the resolved note, text intact', /first note/.test(c) && !/Resolved/.test(c) && /typed/.test(t1) && await p.evaluate(() => !document.querySelector('.note-card.done')));
await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
const t2 = await p.evaluate((ww) => document.querySelector(ww).innerText, ww);
ok('2nd undo reverses the typing', !/typed/.test(t2) && !(await cards()).some((x) => /second/.test(x)));
await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
ok('3rd undo restores the deleted note', (await cards()).some((x) => /second/.test(x)));
await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
ok('redo deletes it again', !(await cards()).some((x) => /second/.test(x)));
// copy button + toggle placement
ok('notes bar has Copy as prompt, no "Claude" wording', await p.evaluate(() => { const t = document.getElementById('panel-notes').innerText; return /Copy as prompt/.test(t) && !/claude/i.test(t); }));
ok('Beside the page toggle sits after the notes', await p.evaluate(() => { const pn = document.getElementById('panel-notes'); return pn.lastElementChild.classList.contains('mn-toggle') || !!pn.querySelector('.mn-toggle') && pn.querySelector('.mn-toggle').compareDocumentPosition(pn.querySelector('.note-card')) & Node.DOCUMENT_POSITION_PRECEDING; }));
// mode switch: editor hidden mid-switch, visible after
// (watched from inside the page: the mask only lasts two animation frames, too short to sample reliably from the test)
await p.evaluate(() => { const e = document.querySelector('.tabview:not([hidden])'); window.__swapSeen = false; new MutationObserver(() => { if (e.classList.contains('mode-swap')) window.__swapSeen = true; }).observe(e, { attributes: true, attributeFilter: ['class'] }); });
await p.click('[data-mode=markdown]');
await p.waitForTimeout(500);
const mid = await p.evaluate(() => window.__swapSeen);
const after = await p.evaluate(() => { const e = document.querySelector('.tabview:not([hidden])'); return e.classList.contains('mode-swap') || e.classList.contains('mode-swap-in'); });
ok('mode switch masks the re-layout, then reveals', mid && !after);
await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(400); await p.click(ww); await sel('Alpha'); await addNote('third note');
ok('note added', (await cards()).some((x) => /third note/.test(x)));
await p.click(ww); await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
ok('Cmd+Z removes a just-added note', !(await cards()).some((x) => /third note/.test(x)));
await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
ok('redo brings it back', (await cards()).some((x) => /third note/.test(x)));
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
