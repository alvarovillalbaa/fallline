// H01: anonymous exact public bytes and actual narrow touch controls; no state injection.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const origin = 'https://fallline-alvaro.vercel.app';
const output = process.env.FALLLINE_OUTPUT;
const manifest = JSON.parse(await readFile('docs/qualification/generated-v5-public-manifest.json', 'utf8'));
const config = JSON.parse(await readFile('docs/qualification/generated-v1-production-vercel.json', 'utf8'));
const expectedPaths = ['favicon.svg', 'index.html', 'src/audio.js', 'src/game.js', 'src/records.js', 'src/renderer.js', 'src/ride.js', 'styles.css'];
assert.deepEqual(manifest.map(row => row.path).sort(), expectedPaths);
const headers = config.headers[0].headers;
const digest = value => createHash('sha256').update(value).digest('hex');
const report = { source: process.env.GITHUB_SHA, releaseSource: process.env.FALLLINE_RELEASE_SOURCE,
  declaredReadyDeployment: process.env.FALLLINE_READY_DEPLOYMENT,
  boundary: 'H01 actual anonymous public responses and emulated native Chromium controls; control-plane identity checked separately',
  passed: false, resources: [], browserResponses: [], errors: [], unexpected: [], cleanup: {} };
assert.match(report.releaseSource, /^[a-f0-9]{40}$/);
assert.match(report.declaredReadyDeployment, /^dpl_[a-zA-Z0-9]+$/);
async function resources(stage) {
  for (const item of manifest) {
    const suffix = item.path === 'index.html' ? '/' : '/' + item.path;
    const response = await fetch(origin + suffix, { redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(8000), headers: { 'Accept-Encoding': 'identity' } });
    const chunks = []; let size = 0;
    for await (const part of response.body) { size += part.byteLength; assert.ok(size <= item.bytes && size <= 2 * 1024**2); chunks.push(part); }
    const bytes = Buffer.concat(chunks);
    assert.equal(response.status, 200); assert.equal(bytes.length, item.bytes); assert.equal(digest(bytes), item.sha256);
    const observed = Object.fromEntries(headers.map(h => [h.key, response.headers.get(h.key)]));
    for (const h of headers) assert.equal(observed[h.key], h.value);
    report.resources.push({ stage, path: suffix, status: response.status, bytes: bytes.length, sha256: digest(bytes), headers: observed });
  }
}
let server, browser, context;
const jobs = new Set();
const track = promise => { jobs.add(promise); promise.then(() => jobs.delete(promise), error => { jobs.delete(promise); report.errors.push(String(error)); }); return promise; };
async function advance(page, milliseconds) { for (let n = 0; n < milliseconds; n += Math.min(500, milliseconds - n)) await page.clock.runFor(Math.min(500, milliseconds - n)); }
const snap = page => page.evaluate(() => ({ mode: document.body.dataset.mode, time: document.getElementById('run-time').textContent,
  rider: document.getElementById('rider-status').textContent, flag: document.getElementById('next-flag').textContent }));
try {
  await resources('before');
  const { chromium } = await import(process.env.FALLLINE_PLAYWRIGHT);
  server = await chromium.launchServer({ headless: true, channel: 'chromium' });
  browser = await chromium.connect(server.wsEndpoint()); report.browser = browser.version();
  context = await browser.newContext({ viewport: { width: 320, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const allowed = new Map(manifest.map(item => [item.path === 'index.html' ? '/' : '/' + item.path, item]));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || !allowed.has(url.pathname) || url.search || !['GET', 'HEAD'].includes(request.method()) || request.postDataBuffer()) {
      report.unexpected.push({ method: request.method(), path: url.origin + url.pathname }); return track(route.abort());
    }
    return track(route.continue());
  });
  await context.routeWebSocket('**/*', route => { report.unexpected.push({ websocket: true }); return route.close(); });
  context.on('response', response => {
    const url = new URL(response.url()), item = allowed.get(url.pathname);
    if (url.origin !== origin || !item) return;
    track((async () => {
      const bytes = await response.body(); assert.equal(response.status(), 200); assert.equal(bytes.length, item.bytes); assert.equal(digest(bytes), item.sha256);
      report.browserResponses.push({ path: url.pathname, bytes: bytes.length, sha256: digest(bytes) });
    })());
  });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(String(error))); page.on('crash', () => report.errors.push('Page crash'));
  await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-15T12:00:01Z'));
  await page.goto(origin, { waitUntil: 'networkidle' }); await advance(page, 200);
  assert.equal((await snap(page)).mode, 'menu');
  const initial = await page.locator('#saved-levels').inputValue();
  await page.locator('#new-map-button').tap(); await advance(page, 200);
  const selected = await page.locator('#saved-levels').inputValue(); assert.notEqual(selected, initial);
  await page.reload({ waitUntil: 'networkidle' }); await advance(page, 200);
  assert.equal(await page.locator('#saved-levels').inputValue(), selected); report.savedLevel = selected;
  await page.locator('#start-button').tap(); await advance(page, 200);
  assert.equal((await snap(page)).mode, 'riding');
  const cdp = await context.newCDPSession(page);
  try {
    const touches = await Promise.all(['jump', 'trick'].map(async (action, i) => {
      const box = await page.locator('[data-action="' + action + '"]').boundingBox(); assert.ok(box);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: i + 1, radiusX: 2, radiusY: 2, force: 1 };
    }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
    await advance(page, 500); report.air = await snap(page); assert.match(report.air.rider, /AIR/); assert.match(report.air.rider, /0 PTS/);
    await advance(page, 3500); report.landed = await snap(page); assert.match(report.landed.rider, /^RIDING/);
    assert.ok(Number(report.landed.rider.match(/(\d+) PTS/)[1]) >= 100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await advance(page, 200);
    assert.deepEqual(await page.locator('[data-action]').evaluateAll(nodes => nodes.filter(n => n.dataset.held === 'true').map(n => n.dataset.action)), []);
  } finally { await cdp.detach(); }
  await page.locator('#pause-button').tap(); report.paused = await snap(page); assert.equal(report.paused.mode, 'paused');
  await advance(page, 1000); assert.deepEqual(await snap(page), report.paused);
  report.fit = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.equal(report.fit.viewport, 320); assert.ok(report.fit.width <= 320);
  await page.screenshot({ path: path.join(output, 'hosted-320.png'), fullPage: true });
  await Promise.allSettled([...jobs]); assert.deepEqual(report.errors, []); assert.deepEqual(report.unexpected, []);
  await resources('after'); assert.ok(report.browserResponses.length >= 7); report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
  try { if (context) { await context.close(); report.cleanup.contextClosed = true; } } catch (error) { report.errors.push(String(error)); }
  try { if (browser) await browser.close(); if (server) await server.close(); } catch (error) { report.errors.push(String(error)); }
  await Promise.allSettled([...jobs]);
  if (server) {
    const child = server.process();
    if (child.exitCode === null) await new Promise(resolve => { const done = () => { clearTimeout(timer); child.off('exit', done); resolve(); }; const timer = setTimeout(done, 3000); child.once('exit', done); });
    let absent = false; try { process.kill(child.pid, 0); } catch (error) { absent = error.code === 'ESRCH'; }
    report.cleanup.native = { pid: child.pid, exitCode: child.exitCode, absent };
  }
  report.passed = Boolean(report.passed && report.errors.length === 0 && report.unexpected.length === 0 && report.cleanup.contextClosed
    && report.cleanup.native?.exitCode === 0 && report.cleanup.native?.absent);
  await writeFile(path.join(output, 'hosted-browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('FALLLINE_HOSTED_RESULT ' + JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
