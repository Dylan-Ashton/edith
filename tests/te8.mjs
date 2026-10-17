// Electron: updating from 3.7.2 (no allowlist yet) keeps open tabs and recent files working, once.
import { _electron as electron } from 'playwright';
import electronPath from 'electron'; // path to the Electron binary for this OS (downloaded on first use)
import fs from 'fs';
const ok = (n, v) => console.log((v ? 'PASS ' : 'FAIL ') + n);
const D = fs.mkdtempSync('/tmp/edith-upg-');
fs.writeFileSync(D + '/kept.md', '# Kept\n\nStill here.\n');
const launch = async () => { const app = await electron.launch({ args: ['electron-app', '--no-sandbox'], executablePath: electronPath }); const p = await app.firstWindow(); await p.waitForTimeout(1800); return { app, p }; };

let { app, p } = await launch();
const ud = await app.evaluate(({ app }) => app.getPath('userData'));
await app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), D + '/kept.md'); await p.waitForTimeout(1200);
ok('file opened', (await p.locator('.tab').allInnerTexts()).some((t) => t.includes('kept.md')));
await app.evaluate(() => process.exit(0)).catch(() => {});

// pretend this profile comes from 3.7.2: no allowlist file
fs.rmSync(ud + '/allowed-files.json', { force: true });
({ app, p } = await launch());
const names = await p.locator('.tab').allInnerTexts();
ok('tab restored after the update', names.some((t) => t.includes('kept.md')));
ok('restored tab is readable', (await p.evaluate((f) => window.native.readFile(f), D + '/kept.md')).ok);
ok('allowlist written and marked as seeded', JSON.parse(fs.readFileSync(ud + '/allowed-files.json', 'utf8')).seeded === true);
ok('seed is one-off', (await p.evaluate((f) => window.native.seedAllowed([f]), D + '/kept.md')) === false);
await app.evaluate(() => process.exit(0)).catch(() => {});
process.exit(0);
