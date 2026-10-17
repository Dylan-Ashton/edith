// PDF import: headings by size, wrapped lines joined into paragraphs, bullets and numbered lists, two-column pages
// read column by column, running headers, footers and page numbers dropped. Fixtures: tests/fixtures/make_fixtures.py
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1200);
const md = {};
for (const f of ['textbook.pdf', 'test.pdf']) {
  await p.setInputFiles('#fileInput', 'tests/fixtures/' + f); await p.waitForTimeout(2500);
  await p.click('[data-mode=markdown]'); await p.waitForTimeout(300);
  md[f] = (await p.evaluate(() => document.querySelector('.tabview:not([hidden]) .toastui-editor-md-container .ProseMirror').innerText)).replace(/\n{3,}/g, '\n\n');
  console.log('=== ' + f + ' ===\n' + md[f].slice(0, 1800));
  await p.keyboard.press('Meta+T'); await p.waitForTimeout(200);
}
const t = md['textbook.pdf'], s = md['test.pdf'];
ok('textbook: section heading', /^## 4\.2 Light-Dependent Reactions$/m.test(t));
ok('textbook: numbered subheadings', ['4.2.1', '4.2.2', '4.2.3'].every((n) => new RegExp('^### ' + n.replace(/\./g, '\\.') + ' The Thylakoid Membrane$', 'm').test(t)));
ok('textbook: wrapped lines joined', t.includes('converts light energy into chemical energy stored in glucose'));
ok('textbook: bullets', /^[*-] Light is absorbed by Photosystem II\.$/m.test(t) && /^[*-] ATP synthase produces ATP\.$/m.test(t));
ok('textbook: running header and page numbers dropped', !/CHAPTER 4/.test(t) && !/^11[234]$/m.test(t));
ok('test.pdf: title and second-page title', /^# Community Garden Overview$/m.test(s) && /^# Seasons$/m.test(s));
ok('test.pdf: subheading', /^## Key points$/m.test(s));
ok('test.pdf: three-line paragraph joined', s.includes('the way volunteers are assigned to plots across seasons. Paragraphs are wrapped across several lines in the PDF.'));
ok('test.pdf: bullets and numbered list', /^- First bullet point here$/m.test(s) && /^1\. Numbered step one$/m.test(s) && /^2\. Numbered step two$/m.test(s));
ok('test.pdf: repeated footer dropped', !/Riverside Garden Club/.test(s));
ok('no page errors', errs.length === 0);
await b.close();
