// Verify deferred loading with the actual production-built app and synthetic entry responses.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root = path.resolve('dist/client');
const rules = ['/engine.js', '/approved-bank.js', '/approved-pricing.js', '/commercial.js', '/journey-engine.js'];
const profile = { name: 'Synthetic Loading Test', company: 'Synthetic Company', website: 'example.com', role: 'Tester', businessEmail: 'loading@example.com' };
const csp = JSON.parse(await readFile('vercel.json', 'utf8')).headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value;
let gate = true;
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const json = (data, headers = {}) => response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }).end(JSON.stringify(data));
  if (pathname === '/api/access/status') return json({ enabled: gate, configured: true, authenticated: !gate || request.headers.cookie?.includes('loading_session=yes'), intakeOnly: true, savingAvailable: false });
  if (pathname === '/api/access/verify') {
    request.resume();
    return request.on('end', () => json({ authenticated: true, saveData: false }, { 'set-cookie': 'loading_session=yes; Path=/; HttpOnly; SameSite=Lax' }));
  }
  if (pathname === '/api/access/logout') return json({ authenticated: false }, { 'set-cookie': 'loading_session=; Path=/; Max-Age=0' });
  if (pathname.startsWith('/api/')) return json({ enabled: false, configured: false });
  const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    let body = await readFile(file);
    if (pathname === '/') body = Buffer.from(body.toString().replace('<head>', '<head><meta name="aoc-access-gate" content="enabled">'));
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream', 'content-security-policy': csp }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
async function enter(page) {
  for (const [id, value] of Object.entries(profile)) await page.locator('#access-' + id).fill(value);
  await page.getByRole('button', { name: 'Continue to calculator', exact: true }).click();
  await page.locator('.area').first().waitFor();
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), requests = [], errors = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    page.on('pageerror', error => errors.push(error.message));
    // Ensure dependency order is independent of download order.
    await context.route('**/engine.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.continue();
    });
    try {
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Continue to calculator', exact: true }).waitFor();
      assert.deepEqual(requests.filter(file => rules.includes(file) || /\/Calculator-.*\.js$/.test(file)), [], 'Entry does not download calculator rules or code');
      assert.equal(await page.evaluate(() => globalThis.AOCJourney), undefined, 'No estimate state exists before entry');
      await enter(page);
      assert.equal(await page.locator('.area').count(), 12);
      assert.equal(await page.evaluate(() => Boolean(globalThis.AOCCommercial?.numericIds?.length)), true, 'Commercial rules initialize before the calculator renders');
      for (const file of rules) assert.equal(requests.filter(request => request === file).length, 1, 'Rules load once: ' + file);
      assert.equal(requests.filter(file => /\/Calculator-.*\.js$/.test(file)).length, 1);
      await page.locator('.area').first().click();
      await page.getByRole('button', { name: /^Describe the work/ }).click();
      await page.locator('#description').fill('Synthetic private description that must not remain available after logout.');
      await page.getByRole('button', { name: 'End session', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to calculator', exact: true }).waitFor();
      await page.waitForFunction(() => !globalThis.AOCJourney);
      await enter(page);
      assert.equal(await page.evaluate(() => AOCJourney.getState().description), '');
      for (const file of rules) assert.equal(requests.filter(request => request === file).length, 1, 'Re-entry reuses loaded rules');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(`PASS: ${width}px deferred rules/code, one load under StrictMode, dependency ordering, logout privacy and empty re-entry.`);
    } finally { await context.close(); }
  }
  for (const blocked of ['**/approved-bank.js', '**/assets/Calculator-*.js']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'loading_session', value: 'yes', url: origin }]);
    const page = await context.newPage();
    await context.route(blocked, route => route.abort());
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.getByRole('alert').filter({ hasText: 'calculator could not load' }).waitFor();
      assert.equal(await page.locator('.area').count(), 0, 'A failed dependency cannot expose a partial calculator');
      await context.unroute(blocked);
      await page.getByRole('button', { name: 'Reload calculator', exact: true }).click();
      await page.locator('.area').first().waitFor();
      assert.equal(await page.locator('.area').count(), 12);
      console.log('PASS: Rules/chunk failure shows a useful retry; reload preserves the approved session: ' + blocked);
    } finally { await context.close(); }
  }
  gate = false;
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('.area').first().waitFor();
  assert.equal(await page.locator('.area').count(), 12, 'Ungated preview remains supported');
  console.log('PASS: Ungated preview opens the same complete calculator. No external providers or production writes.');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
