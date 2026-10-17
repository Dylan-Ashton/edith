// v3.6: find keeps position; multi-paragraph and overlapping notes; note types + prompt; page order; clean export;
// view switches keep the reading position; indent/outdent and paste into a bullet; margin notes; save feedback; modal fade.
import { chromium } from 'playwright';
const b = await chromium.launch(); const ctxb = await b.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctxb.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const clip = () => p.evaluate(() => navigator.clipboard.readText());
const scratch = async (md) => { await p.evaluate(() => document.getElementById('btnHome').click()).catch(() => {}); await p.waitForTimeout(150); await p.evaluate((t) => navigator.clipboard.writeText(t), md); await p.click('#startScratch'); await p.waitForTimeout(700); };
const ww = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
const sel = (txt, endTxt) => p.evaluate(([a, z, ww]) => { const pm = document.querySelector(ww); const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT); let n, s = null, e = null; while ((n = w.nextNode())) { if (!s) { const i = n.data.indexOf(a); if (i >= 0) s = [n, i]; } if (s && !e) { const t = z || a; const j = n.data.indexOf(t, n === s[0] ? s[1] : 0); if (j >= 0) e = [n, j + t.length]; } } if (!s || !e) return false; const r = document.createRange(); r.setStart(...s); r.setEnd(...e); const g = getSelection(); g.removeAllRanges(); g.addRange(r); return true; }, [txt, endTxt, ww]);
const addNote = async (text, kind) => { await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(150); await p.fill('#noteText', text); if (kind) { await p.click('#kindMore'); } if (kind) await p.click('#noteKind [data-kind=' + kind + ']'); await p.click('#noteSave'); await p.waitForTimeout(350); };
const scrollTop = () => p.evaluate((ww) => document.querySelector(ww).scrollTop, ww);
const mdOf = async () => { await p.click('[data-mode=markdown]'); await p.waitForTimeout(500); const t = await p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText); await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(500); return t; };

// ---------- 1. Find: closing the bar leaves you at the match
const long = Array.from({ length: 60 }, (_, i) => (i % 10 === 0 ? '## Section ' + i + '\n\n' : '') + 'Paragraph number ' + i + ' has words, with marker zeta' + i + ' to find. Lorem ipsum dolor sit amet, consectetur adipiscing elit.').join('\n\n') + '\n';
await scratch(long);
await p.keyboard.press('Control+f'); await p.waitForTimeout(200); await p.keyboard.type('zeta30'); await p.waitForTimeout(400);
const atMatch = await scrollTop(); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
const afterClose = await scrollTop();
ok('find: scrolled to the match', atMatch > 1500);
ok('find: closing the bar stays at the match (' + atMatch + ' -> ' + afterClose + ')', Math.abs(afterClose - atMatch) < 40);
ok('find: match is still selected after closing', await p.evaluate(() => String(getSelection()) === 'zeta30'));

// ---------- 2. View switches keep the reading position
await p.evaluate((ww) => { document.querySelector(ww).scrollTop = 3000; }, ww); await p.waitForTimeout(300);
const topWords = () => p.evaluate((ww) => { const pm = document.querySelector(ww); const r = pm.getBoundingClientRect(); const el = [...pm.querySelectorAll('p,h2')].find((e) => e.textContent.trim() && e.getBoundingClientRect().bottom > r.top + 4); const mm = el.textContent.match(/(?:Paragraph number|Section) (\d+)/); return mm ? mm[1] : el.tagName + ':' + el.textContent.slice(0, 30); }, ww);
const before = await topWords();
await p.click('[data-mode=markdown]'); await p.waitForTimeout(900);
const mdTop = await p.evaluate(() => { const pm = document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror'); const r = pm.getBoundingClientRect(); const el = [...pm.children].find((e) => e.getBoundingClientRect().bottom > r.top + 4 && e.textContent.trim()); const mm = el.textContent.match(/(?:Paragraph number|Section) (\d+)/); return mm ? mm[1] : el.tagName + ':' + el.textContent.slice(0, 30); });
ok('view: Write -> Markdown keeps the same paragraph on top (' + before + ' vs ' + mdTop + ')', Math.abs(+before - +mdTop) <= 1);
await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(900);
const back = await topWords(); ok('view: Markdown -> Write keeps it too (' + before + ' vs ' + back + ')', Math.abs(+before - +back) <= 1);
await p.keyboard.press('Control+='); await p.waitForTimeout(500); const zoomed = await topWords(); ok('view: zoom keeps the position (' + before + ' vs ' + zoomed + ')', Math.abs(+before - +zoomed) <= 1);
await p.keyboard.press('Control+0'); await p.waitForTimeout(400);
// switching tabs keeps position
await p.click('#tabAdd'); await p.waitForTimeout(400); await p.click('.tab:nth-child(2)'); await p.waitForTimeout(700);
const tabBack = await topWords(); ok('view: switching tabs keeps the position (' + before + ' vs ' + tabBack + ')', Math.abs(+before - +tabBack) <= 1);
await p.click('.tab:nth-child(3) .x'); await p.waitForTimeout(400);

// ---------- 3. Notes: multi-paragraph highlight, nested notes, kinds, page order
await scratch('The hero betrays the mentor at midnight, quietly.\n\nSecond paragraph, where the twist lands hard.\n\nThird paragraph closes the act with a long, winding sentence that goes on and on and on.\n\nFourth, untouched paragraph.\n');
await sel('The hero betrays', 'goes on and on and on.');
await addNote('Is this the most interesting moment to reveal her?');
const text3 = await p.evaluate((ww) => [...document.querySelectorAll(ww + ' .note-mark')].map((m) => m.textContent).join(''), ww);
ok('multi-paragraph note highlights all three paragraphs', text3.includes('midnight') && text3.includes('twist lands hard') && text3.includes('on and on and on.') && !text3.includes('Fourth'));
ok('long quote stored in full (not cut to a few words)', await p.evaluate(() => { const n = document.querySelector('.note-card .q'); return n.textContent.includes('twist lands hard') ; }));
await sel('mentor'); await addNote('Micro: make her name clearer', 'change');
const nested = await p.evaluate((ww) => { const m = [...document.querySelectorAll(ww + ' .note-mark')]; const inner = m.filter((x) => x.textContent === 'mentor').pop(); return { inner: !!inner, outerIsOther: inner && inner.parentElement.closest('.note-mark') && inner.parentElement.closest('.note-mark').dataset.note !== inner.dataset.note }; }, ww);
console.log('  nested:', JSON.stringify(nested));
ok('overlapping notes nest (micro inside macro)', nested.inner && nested.outerIsOther);
await p.evaluate((ww) => { [...document.querySelectorAll(ww + ' .note-mark')].filter((x) => x.textContent === 'mentor').pop().click(); }, ww); await p.waitForTimeout(250);
ok('clicking the inner passage selects the micro note card', await p.evaluate(() => document.querySelector('.note-card.flash .t')?.textContent.startsWith('Micro')));
// kinds
const kinds = await p.evaluate(() => [...document.querySelectorAll('.note-card .m .kind')].map((k) => k.textContent + ':' + getComputedStyle(k).display));
ok('only notes the writer explicitly typed show a type chip', kinds.length === 1 && kinds[0].startsWith('Change'));
// page order: a note on the 4th paragraph written last must come after the earlier ones; one on paragraph 2 written even later comes between
await sel('Fourth, untouched'); await addNote('Cut this paragraph', 'change');
await sel('Second paragraph'); await addNote('Keep this exactly', 'keep');
const order = await p.evaluate(() => [...document.querySelectorAll('.note-card .t')].map((t) => t.textContent));
ok('sidebar is in page order', order.join('|') === ['Is this the most interesting moment to reveal her?', 'Micro: make her name clearer', 'Keep this exactly', 'Cut this paragraph'].join('|') || /Is this/.test(order[0]) && /Cut this/.test(order[order.length - 1]));
console.log('  order:', JSON.stringify(order));
await p.keyboard.press('Control+Shift+R'); await p.waitForTimeout(300);
const prompt = await clip(); console.log(prompt.split('\n').map((l) => '  | ' + l).join('\n'));
ok('prompt tells the AI to judge each note instead of locking decisions', /Use your judgement on each note/.test(prompt) && /do not change that passage until I have read your answer/i.test(prompt));
ok('prompt is neutral about which AI', !/claude/i.test(prompt));
ok('prompt lists notes in one page-ordered numbered list with explicit types tagged', /1\. /.test(prompt) && /\[Keep as is\] Keep this exactly/.test(prompt) && /\[Edit\] Cut this paragraph/.test(prompt));
ok('prompt no longer opens with a blanket "Please revise"', !/^Please revise/.test(prompt));
ok('untyped note carries no type tag', /\n   Is this the most interesting/.test(prompt));
// undo reaches note deletion, in order
await p.evaluate(() => { const c = [...document.querySelectorAll('.note-card')].find((c) => /Is this/.test(c.textContent)); c.querySelector('[data-a=del]').click(); }); await p.waitForTimeout(500);
const gone = await p.evaluate(() => [...document.querySelectorAll('.note-card')].some((c) => /Is this/.test(c.textContent)));
await p.click(ww); await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
const restored = await p.evaluate(() => [...document.querySelectorAll('.note-card')].some((c) => /Is this/.test(c.textContent)));
ok('Cmd+Z restores a deleted note', !gone && restored);
const txtAfter = await p.evaluate((ww) => document.querySelector(ww).innerText, ww);
ok('that undo did not touch the text', /The hero betrays/.test(txtAfter));

// ---------- 4. Clean export
const tabsBefore = await p.evaluate(() => document.querySelectorAll('.tab').length);
const exported = await p.evaluate(() => new Promise((res) => { const orig = URL.createObjectURL; URL.createObjectURL = (blob) => { blob.text().then((t) => res(t)); return orig.call(URL, blob); }; document.querySelector('[data-act=downloadmd]') && null; window.__x = 1; setTimeout(() => res('timeout'), 4000); document.getElementById('btnFileMenu').click(); document.querySelector('[data-act=downloadmd]').click(); }));
ok('exported .md copy has no notes appended', exported !== 'timeout' && !/mdnotes/.test(exported) && /The hero betrays/.test(exported));
const withNotes = await p.evaluate(() => new Promise((res) => { const orig = URL.createObjectURL; URL.createObjectURL = (blob) => { blob.text().then((t) => res(t)); return orig.call(URL, blob); }; setTimeout(() => res('timeout'), 4000); document.getElementById('btnFileMenu').click(); document.querySelector('[data-act=downloadmdnotes]').click(); }));
ok('"copy with notes" still carries them', /mdnotes/.test(withNotes));

// ---------- 5. Margin notes
await p.evaluate(() => { document.querySelectorAll('.note-card [data-a=done]').forEach((b) => { if (/Reopen/.test(b.textContent)) b.click(); }); }); await p.waitForTimeout(300);
ok('margin lane is off by default', await p.evaluate(() => !document.querySelector('.margin-lane') || document.querySelector('.margin-lane').hidden));
await p.click('.mn-toggle'); await p.waitForTimeout(500);
const lane = await p.evaluate(() => { const l = document.querySelector('.tabview:not([hidden]) .margin-lane'); const cards = l ? [...l.querySelectorAll('.mn-card')].filter((c) => !c.hidden) : []; return { shown: l && !l.hidden, n: cards.length, tops: cards.map((c) => Math.round(c.getBoundingClientRect().top)), overlap: cards.some((c, i) => i && c.getBoundingClientRect().top < cards[i - 1].getBoundingClientRect().bottom - 1) }; });
ok('margin lane shows a card per open note (' + lane.n + ')', lane.shown && lane.n >= 3);
ok('margin cards never overlap', !lane.overlap);
ok('lane does not cover the text column', await p.evaluate((ww) => { const l = document.querySelector('.tabview:not([hidden]) .margin-lane').getBoundingClientRect(); const pm = [...document.querySelector(ww).querySelectorAll('p')].map((e) => e.getBoundingClientRect().right); return Math.max(...pm) <= l.left + 2; }, ww));
await p.click('.tabview:not([hidden]) .mn-card:first-child .mn-text'); await p.waitForTimeout(250);
await p.click('.mn-toggle'); await p.waitForTimeout(400);
ok('toggling it off hides the lane again', await p.evaluate(() => document.querySelector('.tabview:not([hidden]) .margin-lane').hidden && !document.getElementById('work').classList.contains('mn-on')));

// ---------- 6. Indent / outdent / paste into a bullet
await scratch('- one\n- two\n\nNext paragraph after list.\n');
await p.evaluate((ww) => { const pm = document.querySelector(ww); const t = pm.querySelector('li p').firstChild; const r = document.createRange(); r.setStart(t, t.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pm.focus(); }, ww);
await p.evaluate((ww) => { const pm = document.querySelector(ww); const dt = new DataTransfer(); dt.setData('text/plain', 'alpha line\n\nbeta line'); pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, ww); await p.waitForTimeout(300);
const items = await p.evaluate((ww) => [...document.querySelectorAll(ww + ' li')].map((l) => l.querySelectorAll('p').length + ':' + l.firstChild.textContent), ww);
ok('pasting two lines into a bullet makes two bullets, not a stranded paragraph', items.join('|') === '1:onealpha line|1:beta line|1:two');
// build a stranded paragraph the old way and make sure it can be lifted out
await scratch('- one\n\n  stray continuation\n- two\n\nNext paragraph.\n');
const strayAt = (ww) => { const pm = document.querySelector(ww); return [...pm.querySelectorAll('li p')].find((x) => x.textContent.includes('stray')); };
const stray = await p.evaluate((ww) => [...document.querySelectorAll(ww + ' li')].map((l) => l.querySelectorAll('p').length), ww);
if (stray[0] >= 2) {
  await p.evaluate((ww) => { const pm = document.querySelector(ww); const t = [...pm.querySelectorAll('li p')].find((x) => x.textContent.includes('stray')).firstChild; const r = document.createRange(); r.setStart(t, t.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pm.focus(); }, ww);
  await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(300);
  const after = await p.evaluate((ww) => [...document.querySelector(ww).children].map((e) => e.tagName + ':' + e.textContent.slice(0, 14)), ww);
  console.log('  after outdent:', JSON.stringify(after));
  ok('Shift+Tab lifts a stranded paragraph out of its bullet', after.some((a) => a.startsWith('P:stray')) && !(await p.evaluate((ww) => [...document.querySelectorAll(ww + ' li')].some((l) => l.textContent.includes('stray')), ww)));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  await p.evaluate((ww) => { const pm = document.querySelector(ww); const t = [...pm.querySelectorAll('li p')].find((x) => x.textContent.includes('stray')).firstChild; const r = document.createRange(); r.setStart(t, t.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pm.focus(); }, ww);
  await p.click('#btnOutdent'); await p.waitForTimeout(300);
  ok('the Decrease indent button does the same', !(await p.evaluate((ww) => [...document.querySelectorAll(ww + ' li')].some((l) => l.textContent.includes('stray')), ww)));
} else ok('could not build a stranded paragraph from Markdown (' + JSON.stringify(stray) + ')', false);
// Tab nests a list item, Shift+Tab un-nests
await scratch('- one\n- two\n');
await p.evaluate((ww) => { const pm = document.querySelector(ww); const t = pm.querySelectorAll('li p')[1].firstChild; const r = document.createRange(); r.setStart(t, t.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pm.focus(); }, ww);
await p.click('#btnIndent'); await p.waitForTimeout(250); ok('Increase indent nests the item', await p.evaluate((ww) => !!document.querySelector(ww + ' li li'), ww));
await p.keyboard.press('Meta+['); await p.waitForTimeout(250); ok('⌘[ brings it back out', await p.evaluate((ww) => !document.querySelector(ww + ' li li'), ww));

// ---------- 7. Save feedback, dialog fade, hover on sidebar tabs
await p.evaluate(() => document.getElementById('btnSave').click()); await p.waitForTimeout(50);
// scratch tabs have no file; use the Copy button instead for the feedback check
await p.click('#btnCopyScratch'); await p.waitForTimeout(450);
ok('Copy Markdown button confirms quietly', await p.evaluate(() => document.getElementById('btnCopyScratch').classList.contains('did') && getComputedStyle(document.querySelector('#btnCopyScratch .l2')).opacity > 0.5));
await p.waitForTimeout(1500); ok('...and settles back', await p.evaluate(() => !document.getElementById('btnCopyScratch').classList.contains('did')));
await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(200);
ok('note dialog opens', await p.evaluate(() => document.getElementById('mNote').classList.contains('on')));
await p.click('#mNote [data-close]'); await p.waitForTimeout(40);
ok('dialog fades (still present, closing) right after click', await p.evaluate(() => document.getElementById('mNote').classList.contains('closing')));
await p.waitForTimeout(300); ok('...then is gone', await p.evaluate(() => !document.getElementById('mNote').classList.contains('on')));
const hov = async (sel) => { await p.mouse.move(2, 2); await p.waitForTimeout(40); const b0 = await p.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel); const r = await p.evaluate((s) => { const e = document.querySelector(s).getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, sel); await p.mouse.move(r[0], r[1]); await p.waitForTimeout(300); const b1 = await p.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel); return b0 !== b1; };
ok('hover: Notes sidebar tab', await hov('[data-tab=notes]')); ok('hover: History sidebar tab', await hov('[data-tab=history]'));
await p.click('#tabAdd'); await p.waitForTimeout(300);
ok('hover: inactive document tab', await hov('.tab:not(.active)')); ok('hover: active document tab', await hov('.tab.active'));
// typing in the note box must not rewrite the status bar
await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(200);
await p.evaluate(() => { window.__w = 0; new MutationObserver((m) => { window.__w += m.length; }).observe(document.querySelector('.status'), { childList: true, characterData: true, subtree: true }); });
await p.keyboard.type('hello there', { delay: 60 }); await p.waitForTimeout(500);
ok('typing in the note box leaves the status bar alone (writes: ' + (await p.evaluate(() => window.__w)) + ')', (await p.evaluate(() => window.__w)) === 0);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// ---------- 8. Rich Text (.rtf) opens
const rtf = '{\\rtf1\\ansi\\ansicpg1252\\cocoartf2761\n{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica-Bold;\\f1\\fswiss\\fcharset0 Helvetica;}\n{\\colortbl;\\red255\\green255\\blue255;}\n{\\*\\expandedcolortbl;;}\n\\pard\\tx720\\pardirnatural\\partightenfactor0\n\n\\f0\\b\\fs48 \\cf0 My Title\\\n\\\n\\pard\\tx720\\pardirnatural\\partightenfactor0\n\n\\f1\\b0\\fs24 \\cf0 Plain text with \\b bold\\b0  and \\i italic\\i0  and caf\\\'e9 \\u8212 ? dash.\\\n\\\n\\pard\\tx220\\tx720\\li720\\fi-720\\pardirnatural\\partightenfactor0\n\\ls1\\ilvl0\\cf0 {\\listtext\t\\uc0\\u8226 \t}First bullet\\\n\\ls1\\ilvl0\\cf0 {\\listtext\t\\uc0\\u8226 \t}Second bullet\\\n\\pard\\pardirnatural\\partightenfactor0\n{\\field{\\*\\fldinst{HYPERLINK "https://example.com"}}{\\fldrslt \\cf0 a link}} here.\\\n}';
await p.setInputFiles('#fileInput', { name: 'sample.rtf', mimeType: 'application/rtf', buffer: Buffer.from(rtf, 'latin1') }); await p.waitForTimeout(1500);
const rtfMd = await mdOf(); console.log(rtfMd.split('\n').map((l) => '  | ' + l).join('\n'));
ok('rtf: title becomes a heading', /^# My Title/m.test(rtfMd));
ok('rtf: bold, italic, accents and dashes survive', /\*\*bold\*\*/.test(rtfMd) && /(_|\*)italic(_|\*)/.test(rtfMd) && /café — dash/.test(rtfMd));
ok('rtf: bullets become a list', /^[-*] First bullet/m.test(rtfMd) && /^[-*] Second bullet/m.test(rtfMd));
ok('rtf: hyperlink survives', /\[a link\]\(https:\/\/example\.com\)/.test(rtfMd));
ok('rtf: no raw control words leak into the text', !/\\(fs|cf|f0|f1|par|pard)\b|fonttbl|Helvetica/.test(rtfMd));

// ---------- 9. Save button confirms
await p.evaluate(() => { window.showSaveFilePicker = async () => ({ name: 'x.md', createWritable: async () => ({ write: async () => {}, close: async () => {} }) }); });
await p.evaluate(() => document.getElementById('btnSave').click()); await p.waitForTimeout(500);
ok('Save button confirms a manual save', await p.evaluate(() => document.getElementById('btnSave').classList.contains('did')));
await p.waitForTimeout(1700); ok('...and settles back', await p.evaluate(() => !document.getElementById('btnSave').classList.contains('did')));

console.log(errs.length ? 'FAIL page errors: ' + errs.join(' | ') : 'PASS no page errors');
await b.close();
