// Tabs, smart paste, toolbar collapse, zoom, heading shortcut, history viewer, close prompt, session restore.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs=[]; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' @ ' + (e.stack||'').split('\n')[1])); p.on('console', m => { if (m.type()==='error' && !m.text().includes('403')) errs.push('CONSOLE '+m.text()); });
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1500);
await p.screenshot({ path: 's1.png' });
const ww = () => p.locator('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror');
// tabs
await p.keyboard.press('Meta+T'); await p.waitForTimeout(400); log('tabs:', await p.locator('.tab').count(), 'active idx:', await p.evaluate(()=>[...document.querySelectorAll('.tab')].findIndex(t=>t.classList.contains('active'))));
await ww().click(); await p.keyboard.type('# Second doc'); await p.keyboard.press('Enter'); await p.keyboard.type('Hello there'); await p.waitForTimeout(700);
log('dirty tab:', await p.locator('.tab.active.dirty').count(), 'fname:', await p.inputValue('#fname'));
await p.keyboard.press('Meta+Shift+BracketLeft'); await p.waitForTimeout(400); log('after prev tab fname:', await p.inputValue('#fname'), 'outline items:', await p.locator('#panel-outline .ol-item').count());
await p.keyboard.press('Meta+Shift+BracketRight'); await p.waitForTimeout(400); log('back:', await p.inputValue('#fname'), 'outline:', await p.locator('#panel-outline .ol-item').count());
// smart paste of markdown
await ww().click(); await p.keyboard.press('Meta+End');
await p.evaluate(() => { const pm = document.querySelector('.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror'); const dt = new DataTransfer(); dt.setData('text/plain', '## Pasted heading\n\n- alpha\n- beta\n\nSome **bold** text.'); pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
await p.waitForTimeout(500);
log('h2 after paste:', await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .toastui-editor-ww-container h2').length), 'li:', await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .toastui-editor-ww-container li').length), 'strong:', await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .toastui-editor-ww-container strong').length));
// narrow window -> overflow
await p.setViewportSize({ width: 820, height: 700 }); await p.waitForTimeout(400); log('collapse class:', await p.evaluate(()=>document.getElementById('topbar').className), 'more visible:', !await p.evaluate(()=>document.getElementById('moreWrap').hidden), 'overflow:', await p.evaluate(()=>{const t=document.getElementById('topbar');return t.scrollWidth-t.clientWidth}));
await p.screenshot({ path: 's2.png' });
await p.setViewportSize({ width: 1400, height: 900 }); await p.waitForTimeout(400); log('restored class:', JSON.stringify(await p.evaluate(()=>document.getElementById('topbar').className)));
// zoom
await p.keyboard.press('Meta+='); await p.waitForTimeout(100); log('zoom:', await p.textContent('#btnZoom')); await p.keyboard.press('Meta+0'); log('zoom reset:', await p.textContent('#btnZoom'));
// heading shortcut alt
await ww().click(); await p.keyboard.press('Alt+Meta+Digit3'); await p.waitForTimeout(200); log('h3:', await p.evaluate(()=>document.querySelectorAll('.tabview:not([hidden]) .toastui-editor-ww-container h3').length));
// history diff
await p.click('[data-tab=history]'); await p.click('#snapNow'); await p.waitForTimeout(500); await ww().click(); await p.keyboard.type(' extra'); await p.waitForTimeout(600); await p.click('.ver'); await p.waitForTimeout(300); await p.screenshot({ path: 's3.png' });
await p.click('[data-dview=full]'); log('full text visible:', await p.isVisible('#diffFull')); await p.keyboard.press('Escape');
// close tab with discard
await p.keyboard.press('Meta+W'); await p.waitForTimeout(300); log('confirm shown:', await p.isVisible('#mConfirm.on')); await p.click('#mConfirm [data-close]'); await p.waitForTimeout(200); log('discard shown:', await p.isVisible('#mConfirm.on')); await p.click('#confirmOk'); await p.waitForTimeout(400); log('tabs after close:', await p.locator('.tab').count());
// session persisted
log('session:', (await p.evaluate(()=>localStorage.getItem('edith.session'))).slice(0,120));
await p.reload(); await p.waitForTimeout(1500); log('tabs after reload:', await p.locator('.tab').count(), await p.inputValue('#fname'));
await p.screenshot({ path: 's4.png' });
ok('Cmd+T opens a second tab and makes it active', /^tabs: 2 active idx: 1$/.test(out[0] || ''));
ok('typing marks the tab unsaved', /^dirty tab: 1 /.test(out[1] || ''));
ok("switching tabs shows that tab's outline", /outline items: 4$/.test(out[2] || ''));
ok('...and switching back restores it', /outline: 1$/.test(out[3] || ''));
ok('pasted Markdown becomes formatting', /^h2 after paste: 1 li: 2 strong: 1$/.test(out[4] || ''));
ok('narrow window collapses the toolbar into ⋯ without overflow', /c1 c2 more visible: true overflow: 0$/.test(out[5] || ''));
ok('wide window restores the toolbar', /^restored class: "topbar"$/.test(out[6] || ''));
ok('Cmd+= zooms in', /^zoom: 1[01]\d%$/.test(out[7] || ''));
ok('Cmd+0 resets zoom', /^zoom reset: 100%$/.test(out[8] || ''));
ok('Alt+Cmd+3 makes a subheading', /^h3: 1$/.test(out[9] || ''));
ok('history shows the full-text view', /^full text visible: true$/.test(out[10] || ''));
ok('closing an unsaved tab asks first', /^confirm shown: true$/.test(out[11] || ''));
ok('Discard closes the tab', /^tabs after close: 1$/.test(out[13] || ''));
ok('session is restored after reload', /^tabs after reload: 1 untitled\.md$/.test(out[15] || ''));
console.log(errs.join('\n') || 'no errors');
ok('no page errors', !errs.length);
await b.close();
