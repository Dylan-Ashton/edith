// Pasting a block of raw Markdown into Write mode renders it as formatting.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
await p.keyboard.press('Meta+T'); await p.waitForTimeout(300);
const pmSel = '.tabview:not([hidden]) .toastui-editor-ww-container .ProseMirror';
await p.click(pmSel); await p.keyboard.type('Intro line');
await p.evaluate((sel) => { const pm = document.querySelector(sel); const dt = new DataTransfer(); dt.setData('text/plain', '## Pasted heading\n\n- alpha\n- beta\n\nSome **bold** text and a [link](https://x.y).'); pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, pmSel);
await p.waitForTimeout(400);
const html = await p.evaluate((sel) => document.querySelector(sel).innerHTML.replace(/ class="[^"]*"/g,'').slice(0,400), pmSel); console.log(html);
ok('pasted Markdown becomes formatting', html.includes('<h2>Pasted heading</h2>') && /<ul><li><p>alpha<\/p><\/li><li><p>beta<\/p><\/li><\/ul>/.test(html) && html.includes('<strong>bold</strong>') && html.includes('href="https://x.y"'));
await p.click('[data-mode=markdown]'); await p.waitForTimeout(300);
const md = await p.evaluate(()=>document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText); console.log(md);
ok('and round-trips to the same Markdown', md.includes('## Pasted heading') && /^[*-] alpha$/m.test(md) && md.includes('**bold**') && md.includes('[link](https://x.y)'));
await b.close();
