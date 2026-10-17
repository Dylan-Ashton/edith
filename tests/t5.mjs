// Notes: selection bubble, dialog quote, highlights in both modes, card pulse; Preferences shortcut.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message, e.stack.split('\n')[1]));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1000);
// select text by mouse drag on a list item
const li = await p.locator('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror li').first().boundingBox();
await p.mouse.move(li.x+30, li.y+li.height/2); await p.mouse.down(); await p.mouse.move(li.x+200, li.y+li.height/2, {steps:5}); await p.mouse.up(); await p.waitForTimeout(200);
const bubble = await p.isVisible('#noteBubble'); console.log('bubble visible:', bubble); ok('selecting text shows the Add note bubble', bubble);
await p.click('#noteBubble'); await p.waitForTimeout(200); const quote = await p.textContent('#noteQuote'); console.log('quote:', quote); ok('note dialog quotes the selection', quote.length > 5);
await p.fill('#noteText','Check later'); await p.click('#noteSave'); await p.waitForTimeout(2200);
const marks = await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .note-mark').length), inText = (await p.evaluate(()=>(localStorage.getItem('edith.session')||''))).includes('mdnotes'); console.log('marks:', marks, 'draft notes:', inText); ok('note highlighted in Write mode', marks > 0); ok('notes are not written into the document text', !inText);
await p.screenshot({ path: 'shot9.png' });
// switch to markdown: mark should appear there too
await p.click('[data-mode=markdown]'); await p.waitForTimeout(400); const marksMd = await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .note-mark').length); console.log('marks md:', marksMd); ok('note highlighted in Markdown mode', marksMd > 0);
await p.click('[data-mode=wysiwyg]'); await p.waitForTimeout(300);
// click mark -> focus card
await p.click('.note-mark:visible'); await p.waitForTimeout(100); const flash = await p.evaluate(()=>!!document.querySelector('.note-card.flash')); console.log('flash:', flash); ok('clicking a highlight pulses its card', flash);
// prefs
await p.keyboard.press('Meta+,'); await p.waitForTimeout(200); const prefsOpen = await p.isVisible('#mPrefs.on'); console.log('prefs open:', prefsOpen); ok('Cmd+, opens Preferences', prefsOpen); await p.screenshot({ path: 'shot10.png' });
await b.close();
