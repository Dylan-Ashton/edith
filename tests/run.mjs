// Runs the test scripts and fails if any of them crashes, prints a FAIL line or reports a page error.
//   node tests/run.mjs            browser tests (t*.mjs), against dist.html; run `npm run build` first
//   node tests/run.mjs electron   Electron tests (te*.mjs), in a throwaway data folder; on Linux under xvfb-run
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const electron = process.argv[2] === 'electron';
const num = (f) => parseInt(f.replace(/\D/g, ''), 10);
const files = fs.readdirSync('tests').filter((f) => (electron ? /^te\d+\.mjs$/ : /^t\d+\.mjs$/).test(f)).sort((a, b) => num(a) - num(b));
const env = { ...process.env };
// the Electron tests run in order and share one data folder (te2 restarts the app and expects its session back)
if (electron) env.EDITH_TEST_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'edith-test-data-'));
const bad = [];
for (const f of files) {
  const t0 = Date.now();
  const xvfb = electron && process.platform === 'linux' && !process.env.DISPLAY;
  const r = spawnSync(xvfb ? 'xvfb-run' : 'node', (xvfb ? ['-a', 'node'] : []).concat('tests/' + f), { env, encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter((l) => /^FAIL\b|PAGEERROR/.test(l));
  const ok = r.status === 0 && !fails.length;
  console.log((ok ? 'ok   ' : 'FAIL ') + f + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  if (!ok) { bad.push(f); console.log(out.split('\n').map((l) => '     | ' + l).join('\n')); }
}
console.log(bad.length ? '\n' + bad.length + ' of ' + files.length + ' failed: ' + bad.join(', ') : '\nall ' + files.length + ' passed');
process.exit(bad.length ? 1 : 0);
