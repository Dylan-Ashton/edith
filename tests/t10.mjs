// IndexedDB migration: a v1 database (versions with full text, no meta store) gains a meta listing for every version.
import { chromium } from 'playwright';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('file://' + process.cwd() + '/tests/blank.html');
await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('mdeditor', 1); r.onupgradeneeded = () => { const d = r.result; const v = d.createObjectStore('versions', { keyPath: 'id', autoIncrement: true }); v.createIndex('file', 'file'); d.createObjectStore('recent', { keyPath: 'name' }); }; r.onsuccess = () => { const d = r.result; const tx = d.transaction('versions','readwrite'); for (let i=0;i<5;i++) tx.objectStore('versions').add({ file: 'untitled:x', at: Date.now()-i*1000, label: 'Saved', text: '# v'+i+'\n'.repeat(50) }); tx.oncomplete = () => { d.close(); res(); }; }; }));
await p.goto('file://' + process.cwd() + '/dist.html'); await p.waitForTimeout(1500);
const meta = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('mdeditor'); r.onsuccess = () => { const d = r.result; const tx = d.transaction('meta'); const q = tx.objectStore('meta').getAll(); q.onsuccess = () => res(q.result.map(m => [m.id, m.file, m.size])); }; }));
console.log('migrated meta:', meta.length, meta[0]);
ok('every old version gets a meta listing', meta.length === 5 && meta.every((m) => m[1] === 'untitled:x' && m[2] > 0));
await b.close();
