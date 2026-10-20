/** Real browser smoke: catches module-graph errors that Node source tests miss. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const output = 'browser-smoke-artifacts';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const messages = [];
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
page.on('console', m => { if (m.type() === 'error') messages.push('console: ' + m.text()); });
page.on('pageerror', e => messages.push('pageerror: ' + String(e.stack || e.message || e)));
page.on('requestfailed', r => messages.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
let booted = false;
try {
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__m3ch4BootOK === true, undefined, { timeout: 25000 });
    booted = true;
  } catch (e) {
    messages.push('first frame timed out: ' + e.message);
  }
  await page.screenshot({ path: output + '/startup.png' });
  const diag = await page.locator('#startup-diagnostic-detail').textContent().catch(() => null);
  if (diag) messages.push('visible diagnostic: ' + diag);
  console.log('BOOTED:', booted, 'DIAGNOSTIC:', diag || 'none');
  console.log('BROWSER MESSAGES:', messages.join('\n') || 'none');
  if (!booted) throw Error('Browser never rendered its first scene frame.');
} finally {
  await browser.close();
}
