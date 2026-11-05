import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TITLES = [
  'desktop menu guide and keyboard controls affect the ride',
  'three neutral descents finish with exact penalties frozen results and reloaded records',
  'an intentional edge crash preserves the earned course record',
  'pause guide restart and resume clear held keyboard input',
  'narrow touch holds multitouch cancellation and jump affect gameplay',
  'corrupt and disabled storage keep play available with honest record notices',
];
const origin = process.env.FALLLINE_GAMEPLAY_ORIGIN;
const allowedPaths = new Set(['/', '/styles.css', '/favicon.svg', '/src/game.js', '/src/ride.js', '/src/renderer.js', '/src/audio.js', '/src/records.js']);
const report = { schemaVersion: 1, origin, browserVersion: null,
  profile: { clock: 'Playwright clock.runFor; actual requestAnimationFrame callbacks', maxAdvanceMs: 1000, totalVirtualLimitMs: 900000,
    desktop: { width: 1440, height: 1000 }, narrow: { width: 390, height: 844, hasTouch: true, isMobile: true }, physicalDevice: false },
  cases: TITLES.map((title, index) => ({ id: `F0${index + 1}`, title, accepted: false, observations: {}, error: 'unrun' })), errors: [],
  cleanup: { contextsCreated: 0, contextsClosed: 0, browsersCreated: 0, browsersClosed: 0, browserClosed: false, lateChecksComplete: false, failures: [] } };
const browsers = [], contexts = [], events = [], jobs = new Set();
let currentCase = null, virtualMs = 0, imageBytes = 0;
const workEnd = Date.now() + 12 * 60 * 1000;
const counters = { consoleErrors: 0, consoleWarnings: 0, pageErrors: 0, unhandledRejections: 0,
  failedSameOriginRequests: 0, unexpectedRequests: 0, webSockets: 0, credentialRequests: 0 };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function clean(value, maximum = 1000) {
  return String(value).replace(/(?:data|blob):\S+/gu, '[non-public URL]')
    .replace(/https?:\/\/[^\s)\]"'<>]+/gu, raw => { try { const url = new URL(raw); return url.origin + url.pathname; } catch { return '[URL]'; } })
    .replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, maximum);
}
function record(kind, message = '') {
  counters[kind]++;
  const row = { kind, observedDuring: currentCase?.id ?? 'setup', message: clean(message, 384), sha256: sha(String(message)) };
  if (events.length < 16) events.push(row);
}
function checkpoint() { assert(Date.now() <= workEnd, 'browser work deadline exceeded'); }
function stage(name, observations = {}) { if (currentCase) Object.assign(currentCase.observations, { stage: name }, observations); }
async function bounded(promise, milliseconds, label) {
  let timer;
  const tracked = Promise.resolve(promise); jobs.add(tracked);
  tracked.then(() => jobs.delete(tracked), () => jobs.delete(tracked));
  try { return await Promise.race([tracked, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timeout')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function launch(chromium, options = {}) {
  checkpoint();
  const browser = await chromium.launch({ headless: true, timeout: 20000, ...options });
  browsers.push({ browser, closed: false }); report.cleanup.browsersCreated++;
  if (report.browserVersion === null) report.browserVersion = browser.version();
  return browser;
}
async function contextFor(browser, mobile = false, seed = null) {
  checkpoint();
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, serviceWorkers: 'block', acceptDownloads: false, locale: 'en-US' });
  contexts.push({ context, closed: false }); report.cleanup.contextsCreated++;
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(20000);
  await context.route('**/*', async route => {
    const request = route.request();
    let url; try { url = new URL(request.url()); } catch { record('unexpectedRequests', 'invalid URL'); await route.abort(); return; }
    const headers = await request.allHeaders();
    if (headers.authorization || headers.cookie) { record('credentialRequests', url.pathname); await route.abort(); return; }
    if (url.origin !== origin || url.search || !allowedPaths.has(url.pathname) || !['GET', 'HEAD'].includes(request.method())) {
      record('unexpectedRequests', `${request.method()} ${url.origin === origin ? url.pathname : 'different origin'}`); await route.abort(); return;
    }
    await route.continue();
  });
  await context.routeWebSocket('**/*', route => { record('webSockets', 'unexpected WebSocket'); route.close({ code: 1008, reason: 'No game WebSocket contract' }); });
  context.on('page', page => {
    page.on('pageerror', error => record('pageErrors', error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        if (message.text().startsWith('FALLLINE_HARNESS_REJECTION=')) record('unhandledRejections', message.text().slice(27));
        record('consoleErrors', message.text());
      } else if (message.type() === 'warning') counters.consoleWarnings++;
    });
    page.on('requestfailed', request => {
      try { if (new URL(request.url()).origin === origin) record('failedSameOriginRequests', new URL(request.url()).pathname + ': ' + request.failure()?.errorText); }
      catch { record('failedSameOriginRequests', 'unparseable request URL'); }
    });
  });
  // Observation only: no prevention, native API replacement or game-state access.
  await context.addInitScript(() => window.addEventListener('unhandledrejection', event => {
    const reason = typeof event.reason === 'string' ? event.reason : typeof event.reason?.message === 'string' ? event.reason.message : 'Non-Error rejection';
    console.error('FALLLINE_HARNESS_REJECTION=' + reason.slice(0, 2048));
  }));
  if (seed) await context.addInitScript(seed, { origin, sentinel: 'fallline-authored-unrelated-v1' });
  return context;
}
async function open(context) {
  const page = await context.newPage();
  await page.clock.install({ time: new Date() });
  const response = await page.goto(origin + '/', { waitUntil: 'load' });
  assert.equal(response.status(), 200); assert.equal(new URL(response.url()).origin, origin);
  await page.waitForFunction(() => document.body.dataset.mode === 'menu' && document.querySelectorAll('#run-options button').length === 3);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await healthy(page); return page;
}
async function advance(page, milliseconds) {
  assert(Number.isInteger(milliseconds) && milliseconds > 0 && milliseconds <= 1000, 'clock chunk outside authored bound');
  checkpoint(); virtualMs += milliseconds; assert(virtualMs <= report.profile.totalVirtualLimitMs, 'total virtual time exceeded');
  await bounded(page.clock.runFor(milliseconds), 15000, 'actual RAF progression'); checkpoint();
}
const mode = page => page.locator('body').getAttribute('data-mode');
const text = (page, selector) => page.locator(selector).textContent();
async function hud(page) {
  return page.evaluate(() => ({ mode: document.body.dataset.mode, time: document.getElementById('run-time').textContent,
    speed: Number.parseInt(document.getElementById('speed').textContent, 10), next: document.getElementById('next-flag').textContent,
    status: document.getElementById('rider-status').textContent, penalty: document.getElementById('penalty').textContent,
    progress: document.getElementById('progress-fill').style.height }));
}
async function saved(page) {
  return page.evaluate(() => { const raw = localStorage.getItem('fallline.v1'); return raw === null ? null : JSON.parse(raw); });
}
function formatted(seconds) {
  const tenths = Math.floor(seconds * 10);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
async function healthy(page) {
  assert.notEqual(await mode(page), 'error'); assert.equal(await page.locator('#error-overlay').isVisible(), false);
  const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
  assert(layout.documentWidth <= layout.width + 1 && layout.bodyWidth <= layout.width + 1, 'horizontal document overflow');
  return layout;
}
async function buttonBounds(page, selector) {
  const button = page.locator(selector); assert(await button.isVisible()); assert(await button.isEnabled());
  const rect = await button.boundingBox(); assert(rect && rect.width >= 40 && rect.height >= 40, selector + ' has an unusable target');
  return Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value * 100) / 100]));
}
async function pixels(page) {
  const sample = await page.locator('#slope').evaluate(canvas => {
    const ctx = canvas.getContext('2d'), colors = new Set(); let opaque = 0, minimum = 765, maximum = 0, total = 0;
    if (!ctx) throw new Error('Actual Canvas2D is unavailable');
    for (let row = 0; row < 16; row++) for (let column = 0; column < 24; column++) {
      const rgba = ctx.getImageData(Math.floor((column + 0.5) * canvas.width / 24), Math.floor((row + 0.5) * canvas.height / 16), 1, 1).data;
      const sum = rgba[0] + rgba[1] + rgba[2]; total++; if (rgba[3] > 0) opaque++;
      colors.add(`${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]}`); minimum = Math.min(minimum, sum); maximum = Math.max(maximum, sum);
    }
    return { width: canvas.width, height: canvas.height, total, opaque, distinctColors: colors.size, channelSumRange: maximum - minimum };
  });
  assert(sample.width >= 300 && sample.height >= 300 && sample.opaque >= sample.total * 0.9 && sample.distinctColors >= 8 && sample.channelSumRange >= 60,
    'Canvas sample is empty or lacks actual scene variation');
  return sample;
}
async function picture(page, label) {
  const bytes = await page.screenshot({ type: 'jpeg', quality: 30, scale: 'css', timeout: 10000 });
  const entry = { label, type: 'image/jpeg', width: page.viewportSize().width, height: page.viewportSize().height, bytes: bytes.length, sha256: sha(bytes) };
  if (imageBytes + bytes.length <= 70000) { imageBytes += bytes.length; entry.base64 = bytes.toString('base64'); }
  else entry.omitted = 'optional combined 70000-byte image cap';
  return entry;
}
async function select(page, name) {
  assert.equal(await mode(page), 'menu');
  const button = page.getByRole('button', { name: new RegExp('^' + name + ':') }); await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
}
async function start(page, free = false) {
  await page.locator(free ? '#free-button' : '#start-button').click(); assert.equal(await mode(page), 'riding');
  assert.equal(await page.locator('#slope').evaluate(element => element === document.activeElement), true);
}
async function restart(page) {
  assert.equal(await mode(page), 'riding'); await page.keyboard.press('r'); assert.equal(await text(page, '#run-time'), '00:00.0');
}
async function menuFromRide(page) {
  if (await mode(page) === 'riding') await page.keyboard.press('p');
  assert.equal(await mode(page), 'paused'); await page.locator('#pause-menu-button').click(); assert.equal(await mode(page), 'menu');
}
async function finish(page, runId, expectedPassed, expectedMissed) {
  stage('neutral descent: ' + runId);
  let virtual = 0;
  while (await mode(page) === 'riding' && virtual < 160000) { await advance(page, 1000); virtual += 1000; }
  assert.equal(await mode(page), 'result', 'neutral descent did not reach a real terminal result');
  assert.equal(await text(page, '#result-title'), 'That was a good line.');
  const record = (await saved(page)).records[runId]; assert(record, 'a completed neutral descent did not persist its record');
  assert.equal(record.passed, expectedPassed); assert.equal(record.missed, expectedMissed);
  assert.equal(record.passed + record.missed, expectedPassed + expectedMissed);
  assert(Math.abs(record.adjustedTime - record.time - record.missed * 4) <= 0.000001, 'four-second penalty formula differs');
  assert.equal(await text(page, '#result-time'), formatted(record.adjustedTime));
  assert.equal(await text(page, '#result-flags'), `${expectedPassed} / ${expectedPassed + expectedMissed}`);
  assert.equal(await text(page, '#result-detail'), `${formatted(record.time)} on the slope + ${expectedMissed * 4}s for ${expectedMissed} missed flags.`);
  assert.match(await text(page, '#record-message'), /Saved on this device/u);
  const snapshot = await page.locator('#result-overlay').textContent(); await advance(page, 1000); await advance(page, 1000);
  assert.equal(await page.locator('#result-overlay').textContent(), snapshot, 'terminal results changed without restart');
  return { virtualMs: virtual, record, result: { adjusted: await text(page, '#result-time'), flags: await text(page, '#result-flags'), detail: await text(page, '#result-detail') } };
}
async function runCase(index, action) {
  const item = report.cases[index]; currentCase = item; const initialEvents = criticalCount();
  try { item.observations = { ...item.observations, ...await action() }; assert.equal(criticalCount(), initialEvents, 'browser error or network boundary violation'); item.accepted = true; item.error = null; }
  catch (error) { item.accepted = false; item.error = clean(error?.message ?? error, 1600); throw error; }
}
function criticalCount() { return Object.entries(counters).reduce((sum, [key, value]) => sum + (key === 'consoleWarnings' ? 0 : value), 0); }

try {
  assert.equal(process.env.CI, 'true', 'owned CI execution is required');
  assert.equal(origin, 'https://fallline-alvaro.vercel.app', 'only the selected public Fallline origin is allowed');
  const root = process.env.FALLLINE_PLAYWRIGHT_ROOT;
  assert(root && isAbsolute(root), 'absolute CI-owned Playwright installation is required');
  const actualRoot = await realpath(root);
  const packageInfo = JSON.parse(await readFile(join(actualRoot, 'node_modules/playwright/package.json'), 'utf8'));
  assert.equal(packageInfo.version, '1.64.1');
  const { chromium } = await import(pathToFileURL(join(actualRoot, 'node_modules/playwright/index.mjs')).href);
  const browser = await launch(chromium), desktopContext = await contextFor(browser);
  const desktop = await open(desktopContext);

  await runCase(0, async () => {
    stage('menu canvas and guide');
    const menuCanvas = await pixels(desktop), menuImage = await picture(desktop, 'desktop menu');
    stage('menu canvas and guide', { menuCanvas, menuImage });
    const bounds = { start: await buttonBounds(desktop, '#start-button'), guide: await buttonBounds(desktop, '#guide-button') };
    await desktop.locator('#guide-button').click(); assert.equal(await desktop.locator('#guide-dialog').evaluate(node => node instanceof HTMLDialogElement && node.open && node.matches(':modal')), true);
    assert.match(await text(desktop, '#guide-dialog'), /Space/u); await desktop.keyboard.press('Escape'); assert.equal(await desktop.locator('#guide-dialog').isVisible(), false);
    await select(desktop, 'Pines'); assert.equal(await text(desktop, '#run-number'), 'RUN 02'); await select(desktop, 'Meadow');
    await desktop.locator('#steady-camera').check(); assert.equal((await saved(desktop)).steady, true);
    assert.equal(await desktop.locator('#sound-button').getAttribute('aria-pressed'), 'false');
    stage('keyboard brake tuck steer and jump');
    await start(desktop); bounds.pause = await buttonBounds(desktop, '#pause-button'); await advance(desktop, 1000); await advance(desktop, 1000); await advance(desktop, 1000); await advance(desktop, 1000);
    const neutral = await hud(desktop);
    await restart(desktop); await desktop.keyboard.down('ArrowDown');
    try { for (let i = 0; i < 4; i++) await advance(desktop, 1000); } finally { await desktop.keyboard.up('ArrowDown'); }
    const brake = await hud(desktop); assert(brake.speed < neutral.speed - 8, 'brake did not reduce actual HUD speed');
    await restart(desktop); await desktop.keyboard.down('ArrowUp');
    try { for (let i = 0; i < 4; i++) await advance(desktop, 1000); } finally { await desktop.keyboard.up('ArrowUp'); }
    const tuck = await hud(desktop); assert(tuck.speed > neutral.speed + 2, 'tuck did not increase actual HUD speed');
    await restart(desktop); await desktop.keyboard.down('ArrowRight');
    try { await advance(desktop, 1000); await advance(desktop, 800); } finally { await desktop.keyboard.up('ArrowRight'); }
    const right = await hud(desktop); assert.match(right.next, /m left/u);
    await restart(desktop); await desktop.keyboard.down('ArrowLeft');
    try { await advance(desktop, 1000); await advance(desktop, 800); } finally { await desktop.keyboard.up('ArrowLeft'); }
    const left = await hud(desktop); assert.match(left.next, /m right/u);
    await restart(desktop); await desktop.keyboard.down('Space');
    try {
      await advance(desktop, 200); assert.equal((await hud(desktop)).status, 'IN THE AIR');
      for (let i = 0; i < 6; i++) await advance(desktop, 1000);
      assert.equal((await hud(desktop)).status, 'RIDING', 'holding jump repeated after landing');
    } finally { await desktop.keyboard.up('Space'); }
    const ridingCanvas = await pixels(desktop); await healthy(desktop); await menuFromRide(desktop);
    return { bounds, menuCanvas, ridingCanvas, neutral, brake, tuck, right, left, keyboardJumpObserved: true, heldJumpReturnedToSnow: true, menuImage };
  });

  await runCase(1, async () => {
    const courses = [];
    stage('three neutral courses', { courses });
    for (const [id, name, passed, missed] of [['meadow', 'Meadow', 6, 2], ['pines', 'Pines', 2, 8], ['ridge', 'Ridge', 2, 10]]) {
      await select(desktop, name); await start(desktop); const course = await finish(desktop, id, passed, missed);
      assert.equal(course.record.jumps, 0); courses.push({ id, ...course });
      await desktop.locator('#again-button').click(); assert.equal(await mode(desktop), 'riding'); assert.equal(await text(desktop, '#run-time'), '00:00.0');
      await advance(desktop, 250); assert.notEqual(await text(desktop, '#run-time'), '00:00.0'); await menuFromRide(desktop);
    }
    stage('reload earned records'); const before = (await saved(desktop)).records;
    await desktop.reload({ waitUntil: 'load' }); await desktop.waitForFunction(() => document.body.dataset.mode === 'menu');
    assert.deepEqual((await saved(desktop)).records, before); assert.deepEqual(Object.keys(before).sort(), ['meadow', 'pines', 'ridge']);
    for (const [id, name] of [['meadow', 'Meadow'], ['pines', 'Pines'], ['ridge', 'Ridge']]) { await select(desktop, name); assert.match(await text(desktop, '#best-note'), new RegExp('Your best: ' + formatted(before[id].adjustedTime).replace('.', '\\.'))); }
    await healthy(desktop); return { courses, recordsMatchAfterReload: true, restartObserved: 3, profile: 'neutral keyboard course input; real RAF clock-controlled' };
  });

  await runCase(2, async () => {
    stage('deliberate edge crash');
    await select(desktop, 'Meadow'); const before = (await saved(desktop)).records; assert(before.meadow);
    await start(desktop); await desktop.keyboard.down('ArrowRight'); let warningObserved = false, virtual = 0;
    try {
      while (await mode(desktop) === 'riding' && virtual < 40000) { await advance(desktop, 200); virtual += 200; warningObserved ||= await desktop.locator('#ride-warning').isVisible(); }
    } finally { await desktop.keyboard.up('ArrowRight'); }
    assert.equal(await mode(desktop), 'result'); assert.match(await text(desktop, '#result-message'), /Beyond the marked snow/u);
    assert.match(await text(desktop, '#record-message'), /Only completed course runs/u); assert.equal(warningObserved, true);
    assert.deepEqual((await saved(desktop)).records, before); assert.equal(await text(desktop, '#result-time-label'), 'TIME ON THE SLOPE');
    await healthy(desktop); await desktop.locator('#result-menu-button').click();
    return { virtualMs: virtual, warningObserved, crashMessage: 'Beyond the marked snow', earnedRecordsUnchanged: true };
  });

  await runCase(3, async () => {
    stage('pause while keyboard input is held');
    await select(desktop, 'Meadow'); await start(desktop);
    await desktop.keyboard.down('ArrowRight'); await desktop.keyboard.down('Space'); await advance(desktop, 300);
    await desktop.keyboard.press('p'); assert.equal(await mode(desktop), 'paused'); const paused = await hud(desktop);
    await advance(desktop, 1000); await advance(desktop, 1000); assert.deepEqual(await hud(desktop), paused);
    // Do not release the old keys until AFTER resume: pause must have cleared them.
    await desktop.keyboard.press('p'); assert.equal(await mode(desktop), 'riding');
    for (let i = 0; i < 4; i++) await advance(desktop, 1000);
    const resumed = await hud(desktop); assert.equal(resumed.status, 'RIDING'); assert.doesNotMatch(resumed.next, /m (?:left|right)/u);
    await desktop.keyboard.up('ArrowRight'); await desktop.keyboard.up('Space');
    stage('guide pause and explicit resume');
    await desktop.locator('#guide-button').click(); assert.equal(await mode(desktop), 'paused'); assert.match(await text(desktop, '#pause-reason'), /read the guide/u);
    const guidePaused = await text(desktop, '#run-time'); await advance(desktop, 1000); assert.equal(await text(desktop, '#run-time'), guidePaused);
    await desktop.keyboard.press('Escape'); assert.equal(await desktop.locator('#guide-dialog').isVisible(), false); assert.equal(await mode(desktop), 'paused');
    await desktop.locator('#resume-button').click(); await advance(desktop, 300); assert.equal(await mode(desktop), 'riding');
    await restart(desktop); await advance(desktop, 200); assert.equal((await hud(desktop)).status, 'RIDING'); await healthy(desktop); await menuFromRide(desktop);
    return { paused, resumed, pausedTimeFrozen: true, heldKeyboardClearedAcrossPause: true, guideRequiresExplicitResume: true, restartObserved: true };
  });

  await runCase(4, async () => {
    stage('narrow touch profile startup');
    const context = await contextFor(browser, true), page = await open(context); await start(page);
    const session = await context.newCDPSession(page);
    try {
      const bounds = {}; for (const action of ['left', 'right', 'brake', 'tuck', 'jump']) bounds[action] = await buttonBounds(page, `[data-action="${action}"]`);
      stage('actual touch brake tuck and cancellation', { bounds });
      const point = (action, id) => ({ id, x: bounds[action].x + bounds[action].width / 2, y: bounds[action].y + bounds[action].height / 2, radiusX: 5, radiusY: 5, force: 1 });
      const send = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
      const held = action => page.locator(`[data-action="${action}"]`).getAttribute('data-held');
      const initial = await hud(page);
      await send('touchStart', [point('brake', 1)]); assert.equal(await held('brake'), 'true'); await advance(page, 1000);
      const braked = await hud(page); assert(braked.speed < initial.speed - 5); await send('touchEnd', []); assert.equal(await held('brake'), 'false');
      await page.locator('#pause-button').tap(); await page.locator('#restart-button').tap();
      await send('touchStart', [point('tuck', 2)]); for (let i = 0; i < 4; i++) await advance(page, 1000);
      const tucked = await hud(page); assert(tucked.speed > initial.speed + 3); await send('touchCancel', []); assert.equal(await held('tuck'), 'false');
      await send('touchStart', [point('left', 3)]); await send('touchStart', [point('left', 3), point('right', 4)]);
      assert.equal(await held('left'), 'true'); assert.equal(await held('right'), 'true'); await advance(page, 300);
      await send('touchCancel', []); for (const action of ['left', 'right', 'brake', 'tuck', 'jump']) assert.equal(await held(action), 'false');
      await send('touchStart', [point('jump', 5)]); await advance(page, 200); assert.equal((await hud(page)).status, 'IN THE AIR');
      const ridingImage = await picture(page, 'narrow touch riding'), canvas = await pixels(page);
      stage('held touch jump latch and second jump', { ridingImage, canvas });
      for (let i = 0; i < 6; i++) await advance(page, 1000); assert.equal((await hud(page)).status, 'RIDING'); assert.equal(await held('jump'), 'true');
      await send('touchEnd', []); assert.equal(await held('jump'), 'false');
      await advance(page, 100); assert.equal((await hud(page)).status, 'RIDING');
      await send('touchStart', [point('jump', 6)]); await advance(page, 200); assert.equal((await hud(page)).status, 'IN THE AIR'); await send('touchCancel', []);
      const layout = await healthy(page);
      return { bounds, initial, braked, tucked, multitouchHeld: ['left', 'right'], cancelClearedAll: true,
        heldJumpReturnedToSnow: true, releaseAllowedSecondJump: true, canvas, layout, ridingImage,
        input: 'CDP Input.dispatchTouchEvent; real Chromium pointer events', physicalTouchDevice: false };
    } finally { await bounded(session.detach(), 5000, 'touch CDP detach'); }
  });

  await runCase(5, async () => {
    stage('authored corrupt save profile');
    const corruptContext = await contextFor(browser, false, ({ origin, sentinel }) => {
      if (location.origin === origin && !sessionStorage.getItem('fallline-authored-seeded')) {
        localStorage.setItem('fallline.v1', '{authored-corrupt'); localStorage.setItem('fallline-authored-unrelated', sentinel);
        sessionStorage.setItem('fallline-authored-seeded', 'true');
      }
    });
    const corrupt = await open(corruptContext); assert.equal(await corrupt.locator('#storage-notice').isVisible(), false);
    assert.equal(await text(corrupt, '#best-note'), 'Your first tracks are waiting.');
    await select(corrupt, 'Meadow'); await start(corrupt); const recovered = await finish(corrupt, 'meadow', 6, 2);
    assert.equal(await corrupt.evaluate(() => localStorage.getItem('fallline-authored-unrelated')), 'fallline-authored-unrelated-v1');
    await corrupt.reload({ waitUntil: 'load' }); await corrupt.waitForFunction(() => document.body.dataset.mode === 'menu');
    assert.match(await text(corrupt, '#best-note'), /Your best:/u);
    stage('genuine disabled local storage profile');
    const disabledBrowser = await launch(chromium, { args: ['--disable-local-storage'] });
    const deniedContext = await contextFor(disabledBrowser, false, ({ origin, sentinel }) => { if (location.origin === origin) sessionStorage.setItem('fallline-authored-unrelated-session', sentinel); });
    const denied = await open(deniedContext);
    const denial = await denied.evaluate(() => {
      let getterFailed = false, readFailed = false, writeFailed = false, objectPresent = false;
      let store; try { store = window.localStorage; objectPresent = store !== null && store !== undefined; } catch { getterFailed = true; }
      try { store.getItem('fallline.v1'); } catch { readFailed = true; }
      try { store.setItem('fallline-authored-denial-probe', 'authored'); store.removeItem('fallline-authored-denial-probe'); } catch { writeFailed = true; }
      return { getterFailed, readFailed, writeFailed, objectPresent };
    });
    stage('verify disabled storage and complete actual run', { denial });
    assert.equal(denial.readFailed, true); assert.equal(denial.writeFailed, true, 'Chromium ignored the genuine storage-disable profile');
    assert.equal(await denied.locator('#storage-notice').isVisible(), true); assert.match(await text(denied, '#storage-notice'), /could not save preferences or records/u);
    await start(denied); let advanced = 0;
    while (await mode(denied) === 'riding' && advanced < 160000) { await advance(denied, 1000); advanced += 1000; }
    assert.equal(await mode(denied), 'result'); assert.equal(await text(denied, '#result-title'), 'That was a good line.');
    assert.equal(await text(denied, '#record-message'), 'A new personal best for this visit.');
    assert.doesNotMatch(await text(denied, '#record-message'), /Saved on this device/u);
    await denied.locator('#result-menu-button').click(); assert.match(await text(denied, '#best-note'), /Best this visit:/u);
    await denied.reload({ waitUntil: 'load' }); await denied.waitForFunction(() => document.body.dataset.mode === 'menu');
    assert.equal(await text(denied, '#best-note'), 'Your first tracks are waiting.');
    assert.equal(await denied.evaluate(() => sessionStorage.getItem('fallline-authored-unrelated-session')), 'fallline-authored-unrelated-v1');
    await healthy(denied);
    return { corruptJSONRecovered: true, recoveredRecord: recovered.record, unrelatedLocalStoragePreserved: true,
      deniedBrowserVersion: disabledBrowser.version(), denial, deniedVirtualMs: advanced, deniedRunCompleted: true,
      truthfulVisitOnlyRecord: true, recordNotPromisedAfterReload: true, unrelatedSessionStoragePreserved: true,
      inaccessibleLocalStoragePreservation: 'not observable or claimed' };
  });
} catch (error) {
  report.errors.push(clean(error?.message ?? error, 1600));
} finally {
  currentCase = null;
  for (const item of [...contexts].reverse()) {
    try { await bounded(item.context.close({ reason: 'Fallline authored browser scope complete' }), 15000, 'browser context close'); item.closed = true; report.cleanup.contextsClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message, 300)); }
  }
  for (const item of [...browsers].reverse()) {
    try { await bounded(item.browser.close({ reason: 'Fallline authored browser scope complete' }), 15000, 'browser close'); item.closed = true; report.cleanup.browsersClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message, 300)); }
  }
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  report.cleanup.browserClosed = browsers.length > 0 && browsers.every(item => item.closed);
  report.cleanup.lateChecksComplete = true;
  if (jobs.size) { report.cleanup.failures.push('unfinished bounded operations remain after browser close'); report.cleanup.lateChecksComplete = false; }
  report.boundaries = { ...counters, events, totalVirtualMs: virtualMs, network: 'only eight exact own-origin GET/HEAD resources; no fulfillment or API calls' };
  if (criticalCount()) report.errors.push('browser errors or network-boundary failures were observed, including teardown observations');
  if (report.cleanup.contextsCreated !== report.cleanup.contextsClosed || !report.cleanup.browserClosed || report.cleanup.failures.length) report.errors.push('resource cleanup was not verified');
  report.proofLimits = ['clock-controlled Chromium RAF gameplay is not real-time performance evidence', '390x844 touch emulation is not a physical-device result',
    'driver closes observed contexts and browsers; outer CI owns independent browser-process and filesystem cleanup', 'no audio audibility, reputation, account, native/store or full-product claim'];
  let serialized = JSON.stringify(report);
  if (Buffer.byteLength(serialized) > 128 * 1024) {
    for (const item of report.cases) for (const key of ['menuImage', 'ridingImage']) {
      const image = item.observations[key]; if (image?.base64) { delete image.base64; image.omitted = 'optional image omitted to retain report bound'; }
    }
    serialized = JSON.stringify(report);
  }
  if (Buffer.byteLength(serialized) > 128 * 1024) {
    report.errors.push('report cap exceeded');
    serialized = JSON.stringify({ schemaVersion: 1, origin, browserVersion: report.browserVersion, cases: report.cases.map(({ id, title }) => ({ id, title, accepted: false, observations: {}, error: 'report cap exceeded' })), errors: ['report cap exceeded'], cleanup: report.cleanup });
  }
  const passed = report.cases.every(item => item.accepted) && report.errors.length === 0 && report.cleanup.failures.length === 0 && report.cleanup.lateChecksComplete;
  const emitEnd = Date.now() + 2000;
  const timer = setTimeout(() => { process.stdout.destroy(); process.exit(1); }, 2000);
  process.stdout.write('FALLLINE_GAMEPLAY_RESULT=' + serialized + '\n', () => { clearTimeout(timer); process.exit(passed && Date.now() <= emitEnd ? 0 : 1); });
}
