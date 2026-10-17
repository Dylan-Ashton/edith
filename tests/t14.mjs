// Home is a persistent view beside open tabs.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const out = []; const log = (...a) => { console.log(...a); out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs=[]; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' @ ' + (e.stack||'').split('\n')[1]));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
// home while a tab exists
await p.click('#btnHome'); await p.waitForTimeout(300); log('home with tab:', await p.isVisible('#start'), 'tabs still:', await p.locator('.tab').count(), 'home active:', await p.evaluate(()=>document.getElementById('btnHome').classList.contains('active')));
await p.keyboard.press('Meta+Shift+H'); await p.waitForTimeout(300); log('back to doc:', !await p.isVisible('#start'));
await p.click('#btnHome'); await p.click('.tab'); await p.waitForTimeout(300); log('tab click leaves home:', !await p.isVisible('#start'));
// ⌘T from home
await p.click('#btnHome'); await p.keyboard.press('Meta+T'); await p.waitForTimeout(300); log('new tab from home:', await p.locator('.tab').count(), !await p.isVisible('#start'));
// editing shortcut blocked on home? open home, press ⌘B -> no error
await p.click('#btnHome'); await p.keyboard.press('Meta+B'); await p.waitForTimeout(900);
// reload with home shown -> restored
await p.reload(); await p.waitForTimeout(1500); log('home restored after reload:', await p.isVisible('#start'), 'tabs:', await p.locator('.tab').count());
await p.screenshot({ path: 'h1.png' });
await p.setViewportSize({ width: 900, height: 700 }); await p.waitForTimeout(300); await p.screenshot({ path: 'h2.png' });
ok('Home opens without closing tabs', /^home with tab: true tabs still: 1 home active: true$/.test(out[0] || ''));
ok('Shift+Cmd+H goes back to the document', /^back to doc: true$/.test(out[1] || ''));
ok('clicking a tab leaves Home', /^tab click leaves home: true$/.test(out[2] || ''));
ok('Cmd+T from Home opens a tab', /^new tab from home: 2 true$/.test(out[3] || ''));
ok('Home and tabs are restored after reload', /^home restored after reload: true tabs: 2$/.test(out[4] || ''));
console.log(errs.join('\n') || 'no errors');
ok('no page errors', !errs.length);
await b.close();
