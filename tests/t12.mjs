// Checklist toolbar button.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300);
const pm = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
await p.click(pm); await p.keyboard.type('todo item');
await p.click('[data-cmd=taskList]'); await p.waitForTimeout(200);
const html = await p.evaluate((s)=>document.querySelector(s).innerHTML, pm); console.log(html); ok('checklist button makes a task item', html.includes('task-list-item'));
await p.click('[data-mode=markdown]'); await p.waitForTimeout(300);
const md = await p.evaluate(()=>document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText); console.log(md); ok('saved as a Markdown checkbox', /^[*-] \[ \] todo item$/m.test(md));
await b.close();
