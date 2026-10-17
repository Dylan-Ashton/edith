// Checklist bullets, page width, zoom menu, focus mode, note jump, word count, Home, What's new.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs=[]; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' @ ' + (e.stack||'').split('\n')[1]));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1500);
const pm = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
// checklist from a plain paragraph
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300); await p.click(pm); await p.keyboard.type('intro paragraph'); await p.keyboard.press('Enter'); await p.keyboard.type('todo item');
await p.click('[data-cmd=taskList]'); await p.waitForTimeout(200);
log('task items:', await p.evaluate((s)=>document.querySelectorAll(s+' li.task-list-item').length, pm), 'bg of ::before:', await p.evaluate((s)=>getComputedStyle(document.querySelector(s+' li.task-list-item'),'::before').backgroundImage.slice(0,20), pm));
// page padding + scrollbar: contents element full width?
log('contents width vs container:', await p.evaluate((s)=>{const c=document.querySelector(s); return [c.getBoundingClientRect().width, c.parentElement.getBoundingClientRect().width, getComputedStyle(c).paddingLeft]}, pm));
// zoom menu
await p.click('#btnZoom'); await p.waitForTimeout(100); log('zoom menu open:', !await p.evaluate(()=>document.getElementById('zoomMenu').hidden));
await p.click('[data-zoom="130"]'); log('zoom:', await p.textContent('#btnZoom'));
await p.click('#btnZoom'); await p.click('[data-width="full"]'); log('width class:', await p.evaluate(()=>document.getElementById('work').className));
await p.click('#btnZoom'); await p.click('[data-zoom="100"]'); await p.click('#btnZoom'); await p.click('[data-width="normal"]');
// focus mode
await p.keyboard.press('Meta+Shift+F'); log('focus:', await p.evaluate(()=>document.body.classList.contains('focus'))); await p.keyboard.press('Escape'); log('focus off:', !await p.evaluate(()=>document.body.classList.contains('focus')));
// note card click jumps
await p.evaluate((s) => { const el=document.querySelector(s+' li'); const r=document.createRange(); r.selectNodeContents(el); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); }, pm);
await p.keyboard.press('Meta+Shift+M'); await p.fill('#noteText','later'); await p.click('#noteSave'); await p.waitForTimeout(300);
await p.evaluate((s)=>{ const sp=document.querySelector(s); sp.scrollTop=sp.scrollHeight; }, pm);
await p.click('.note-card .t'); await p.waitForTimeout(200); log('scrolled to note:', await p.evaluate((s)=>document.querySelector(s).scrollTop < 300, pm));
// selection word count
log('status:', await p.textContent('#stWords'));
await p.screenshot({ path: 's6.png' });
// close all tabs -> start page
for (let i=0;i<2;i++){ await p.keyboard.press('Meta+W'); await p.waitForTimeout(300); if (await p.isVisible('#mConfirm.on')) { await p.click('#mConfirm [data-close]'); await p.waitForTimeout(150); await p.click('#confirmOk'); } await p.waitForTimeout(400); }
log('start visible:', await p.isVisible('#start'), 'tabs:', await p.locator('.tab').count());
await p.screenshot({ path: 's7.png' });
await p.click('#startNew'); await p.waitForTimeout(300); log('after new:', await p.locator('.tab').count(), 'start hidden:', !await p.isVisible('#start'));
// changelog
await p.click('#btnFileMenu'); await p.click('[data-act=whatsnew]'); await p.waitForTimeout(200); log('changelog h2s:', await p.evaluate(()=>document.querySelectorAll('#changelogBody h2').length));
ok('checklist item draws a checkbox, not a bullet', /^task items: 1 bg of ::before: url\(/.test(out[0] || ''));
ok('zoom menu opens', /^zoom menu open: true$/.test(out[2] || ''));
ok('zoom preset applies', /^zoom: 13\d%$/.test(out[3] || ''));
ok('Full window page width applies', /w-full$/.test(out[4] || ''));
ok('focus mode on', /^focus: true$/.test(out[5] || ''));
ok('Escape leaves focus mode', /^focus off: true$/.test(out[6] || ''));
ok('clicking a note card scrolls to it', /^scrolled to note: true$/.test(out[7] || ''));
ok('word count in the status bar', /^status: \d+ words$/.test(out[8] || ''));
ok('Home shows with no tabs', /^start visible: true tabs: 0$/.test(out[9] || ''));
ok('New from Home opens a tab', /^after new: 1 start hidden: true$/.test(out[10] || ''));
ok("What's new lists the changelog", /^changelog h2s: [1-9]\d*$/.test(out[11] || ''));
console.log(errs.join('\n') || 'no errors');
ok('no page errors', !errs.length);
await b.close();
