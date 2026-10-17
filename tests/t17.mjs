// Note anchoring survives edits and Markdown-mode quotes; Replace all undo; scratch/prompt basics.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
await p.evaluate(() => navigator.clipboard.writeText('# Plan\n\nThe hero **betrays the mentor** at the end.\n\nA second paragraph about the villain and their long plan to take the throne.\n'));
await p.keyboard.press('Meta+Shift+H'); await p.click('#startScratch'); await p.waitForTimeout(600);
const marks = () => p.evaluate(() => [...document.querySelectorAll('.tabview:not([hidden]) .note-mark')].map(m => m.textContent).join('|'));
const sel = (t) => p.evaluate((t) => { const pm = [...document.querySelectorAll('.tabview:not([hidden]) .ProseMirror')].find(e => e.offsetParent); const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf(t); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } } return false; }, t);
const note = async (t, txt) => { await sel(t); await p.keyboard.press('Meta+Shift+M'); await p.fill('#noteText', txt); await p.click('#noteSave'); await p.waitForTimeout(250); };
await note('A second paragraph about the villain and their long plan', 'Too vague.');
ok('highlight created', (await marks()).includes('second paragraph'));
// edit inside the quoted passage
await sel('their long plan'); await p.keyboard.type('his scheme'); await p.waitForTimeout(500);
ok('highlight survives edit inside passage', (await marks()).includes('A second paragraph'));
// Markdown-mode note on bold text lands in Write mode
await p.keyboard.press('Meta+Shift+2'); await p.waitForTimeout(400);
await p.click('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror:visible'); await p.keyboard.press('Control+Home'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Home'); await p.keyboard.press('Shift+End'); await p.waitForTimeout(200);
await p.keyboard.press('Meta+Shift+M'); await p.fill('#noteText', 'Contradicts act 2.'); await p.click('#noteSave'); await p.waitForTimeout(300);
await p.keyboard.press('Meta+Shift+1'); await p.waitForTimeout(500);
//console.log('MARKS', await marks(), '| QUOTES', await p.evaluate(() => [...document.querySelectorAll('.note-card .q')].map(q => q.textContent)));
ok('Markdown-mode note highlights in Write mode', (await marks()).includes('betrays the mentor'));
// Replace all then undo
await p.keyboard.press('Meta+F'); await p.fill('#findQ', 'villain'); await p.fill('#findR', 'rival'); await p.click('#replAll'); await p.waitForTimeout(400); await p.click('#findClose');
const txt = () => p.evaluate(() => [...document.querySelectorAll('.tabview:not([hidden]) .ProseMirror')].find(e => e.offsetParent).innerText);
ok('replace all applied', (await txt()).includes('rival'));
await p.click('.tabview:not([hidden]) .ProseMirror:visible'); await p.keyboard.press('Control+Z'); await p.waitForTimeout(400);
//console.log('TXT', JSON.stringify(await txt()));
ok('one undo reverts replace all', (await txt()).includes('villain') && !(await txt()).includes('rival'));
await p.keyboard.press('Control+Shift+Z'); await p.waitForTimeout(300); ok('redo re-applies', (await txt()).includes('rival'));
ok('no page errors', errs.length === 0); if (errs.length) console.log(errs);
await b.close();
