// A note on text inside a table cell.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300);
const pm='.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
await p.evaluate((s)=>{ const pm=document.querySelector(s); const dt=new DataTransfer(); dt.setData('text/plain','# Doc B\n\n| a | b |\n| --- | --- |\n| 15,267 | x |\n\n'+'Filler paragraph. '.repeat(400)); pm.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); }, pm);
await p.waitForTimeout(500);
await p.evaluate((s)=>{ const td=[...document.querySelectorAll(s+' td')].find(t=>t.textContent.includes('15,267')); const r=document.createRange(); r.selectNodeContents(td.querySelector('p')||td); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); }, pm);
console.log('selected:', await p.evaluate(()=>String(getSelection())));
await p.keyboard.press('Meta+Shift+M'); await p.waitForTimeout(200); const quote = await p.textContent('#noteQuote'); console.log('quote shown:', quote); ok('note on a table cell quotes the cell', quote.includes('15,267'));
await p.fill('#noteText','TEST'); await p.click('#noteSave'); await p.waitForTimeout(400);
const marks = await p.evaluate(()=>document.querySelectorAll('.note-mark').length); ok('table-cell note is highlighted', marks >= 1);
console.log('marks:', marks, 'session notes:', await p.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('edith.session')||'{}').tabs?.map(t=>t.text?.slice(-120)))));
await b.close();
