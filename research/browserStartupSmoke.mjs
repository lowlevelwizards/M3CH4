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
  // Reproduce the iPhone user's second failure: a staged cab is installed in
  // Rig 02 with no frame. It may be inspected and quoted before commissioning.
  const fixture = await page.evaluate(async () => {
    const { BY_ID } = await import('./components.js');
    const { loadMachine, storeMachine } = await import('./persistence.js');
    const { loadStable, mountPartOnRig, storeStable } = await import('./stable.js');
    const live = loadMachine(localStorage);
    const cab = live.assembly.owned.find(p => BY_ID.get(p.definitionId)?.slot === 'command');
    if (!cab) throw Error('Starter fixture has no cab');
    const serial = 'BROWSER-STAGED-CAB';
    live.assembly.owned.push({ ...cab, serial, condition: .42, wear: 0, repairs: 0, destroyed: false });
    if (!storeMachine(localStorage, live)) throw Error('Could not store browser fixture');
    const stable = loadStable(localStorage).stable;
    const mounted = mountPartOnRig(stable, 'rig-02', 'command', serial);
    if (!mounted.ok) throw Error('Could not stage cab: ' + mounted.reason);
    if (!storeStable(localStorage, stable)) throw Error('Could not store staged bay');
    sessionStorage.setItem('m3ch4-viewed-bay-v1', 'rig-02');
    return { serial, installed: stable.rigs.find(r => r.id === 'rig-02').installed };
  });
  if (Object.keys(fixture.installed).length !== 1 || fixture.installed.command !== fixture.serial)
    throw Error('Fixture accidentally fielded a complete rig');
  // The current live game persists its own in-memory inventory on pagehide.
  // Seed the prepared save *before* JS modules run after reload, otherwise
  // pagehide overwrites this synthetic extra part with the older inventory.
  const prepared = await page.evaluate(() => ({
    machine: localStorage.getItem('mech-arena-machine-v8'),
    stable: localStorage.getItem('m3ch4-stable-v1'),
  }));
  if (!prepared.machine || !prepared.stable) throw Error('Browser fixture save missing');
  await page.addInitScript(`(() => {
    if (!location.pathname.endsWith('/index.html')) return;
    localStorage.setItem('mech-arena-machine-v8', ${JSON.stringify(prepared.machine)});
    localStorage.setItem('m3ch4-stable-v1', ${JSON.stringify(prepared.stable)});
    sessionStorage.setItem('m3ch4-viewed-bay-v1', 'rig-02');
  })();`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__m3ch4BootOK === true, undefined, { timeout: 25000 });
  await page.locator('#unified-garage .unified-station').nth(3).click({ timeout: 12000 });
  const garageState = await page.evaluate(() => ({
    view: document.querySelector('#unified-garage')?.dataset.mode,
    selected: document.querySelector('#unified-garage .unified-station.selected')?.textContent,
    modules: document.querySelector('#unified-garage .unified-modules')?.textContent?.slice(0,800),
    hasQuote: !!document.querySelector('#unified-garage .unified-service'),
    startupError: document.querySelector('#startup-diagnostic-detail')?.textContent,
    garageText: document.querySelector('#unified-garage')?.textContent?.slice(0,1200),
  }));
  console.log('STAGED BAY DOM AFTER SELECT:', JSON.stringify(garageState));
  await page.waitForFunction(() => document.querySelector('#startup-diagnostic') ||
    document.querySelector('#unified-garage .unified-service'), undefined, { timeout: 6000 });
  await page.screenshot({ path: output + '/staged-rig-02.png' });
  const stagedError = await page.locator('#startup-diagnostic-detail').textContent().catch(() => null);
  const quote = await page.locator('#unified-garage .unified-service').textContent().catch(() => null);
  console.log('STAGED RIG QUOTE:', quote || 'none', 'ERROR:', stagedError || 'none');
  if (stagedError || !quote || !quote.includes('SERVICE CAB'))
    throw Error('Cannot inspect a partial Rig 02: ' + (stagedError || quote || 'missing repair quote'));

  // The first real iPhone audio milestone: DEV -> SOUND TEST BENCH -> one
  // tapped WebAudio audition, without affecting any rig or save data.
  await page.locator('#dev-toggle').click({ timeout: 12000 });
  await page.locator('#audio-bench-open').click({ timeout: 12000 });
  await page.locator('#audio-bench [data-weapon="gun-scatter"]').click({ timeout: 12000 });
  await page.locator('#audio-bench [data-variation="B"]').click({ timeout: 12000 });
  const benchStatus = await page.locator('#audio-bench-status').textContent();
  const benchRecipe = await page.locator('#audio-bench .audio-lab-identity').textContent();
  console.log('SOUND LAB:', benchRecipe, benchStatus);
  if (!benchStatus.includes('TRIGGERED') || !benchStatus.includes('S-6 SCATTERGUN / B'))
    throw Error('DEV Audio Lab did not trigger a WebAudio audition');
  await page.screenshot({ path: output + '/audio-lab-iphone-landscape.png' });
  await page.locator('#audio-bench .audio-lab-dismiss').click({ timeout: 12000 });
  if (!(await page.locator('#audio-bench').evaluate(node=>node.classList.contains('hidden'))))
    throw Error('Audio Lab did not close');
  if (await page.locator('#startup-diagnostic-detail').count())
    throw Error('Audio Lab introduced a startup/runtime error');

} finally {
  await browser.close();
}
