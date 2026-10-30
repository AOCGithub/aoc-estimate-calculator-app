// Opt-in: one short real WebRTC transcription, using a synthetic WAV, never the user's microphone.
import assert from 'node:assert/strict';
import { readFile, access, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { localApi } from '../server/local-api.mjs';

const audioIndex = process.argv.indexOf('--audio');
if (!process.argv.includes('--live') || audioIndex < 0 || !process.argv[audioIndex + 1]) {
  throw new Error('Opt in with --live --audio path/to/synthetic.wav. This uses paid realtime audio.');
}
const production = process.argv.includes('--production');
const checkCorrection = process.argv.includes('--check-correction');
const width = process.argv.includes('--mobile') ? 390 : 1440;
if (!production && !process.env.OPENAI_API_KEY) throw new Error('Load the server API key first; never put it in browser code.');
const audio = path.resolve(process.argv[audioIndex + 1]);
const expectedIndex = process.argv.indexOf('--expect-first');
const expectedFirst = expectedIndex < 0 ? '' : process.argv[expectedIndex + 1];
assert.ok(expectedIndex < 0 || expectedFirst, '--expect-first needs the expected opening word.');
assert.equal(path.extname(audio).toLowerCase(), '.wav');
await access(audio);
const root = path.resolve('dist/client');
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(file => file && existsSync(file));
assert.ok(executablePath, 'A Chromium browser is required.');
let middleware;
localApi({ ...process.env, AOC_ACCESS_GATE_ENABLED: 'false', AOC_VOICE_ENABLED: 'true', AOC_DESCRIPTION_CORRECTION_ENABLED: 'false' })
  .configureServer({ middlewares: { use(handler) { middleware = handler; } } });
const server = http.createServer((request, response) => {
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  middleware(request, response, async () => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/voice-test.wav') {
      response.writeHead(200, { 'content-type': 'audio/wav' }).end(await readFile(audio));
      return;
    }
    const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    try {
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      response.writeHead(200, { 'content-type': type }).end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
});
const originalFetch = globalThis.fetch;
let providerRequests = 0;
globalThis.fetch = async (url, options) => {
  const response = await originalFetch(url, options);
  if (typeof url === 'string' && url.startsWith('https://api.openai.com/')) {
    providerRequests++;
    console.log('Provider handshake:', new URL(url).pathname, response.status);
    if (!response.ok) {
      const data = await response.clone().json().catch(() => ({}));
      console.log(JSON.stringify({ code: data.error?.code, type: data.error?.type, param: data.error?.param }));
    }
  }
  return response;
};
let browser;
try {
  if (!production) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = production ? 'https://estimate.alwaysopencommerce.com' : 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  let voiceStarts = 0, correctionRequests = 0;
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    if (request.url() === origin + '/api/voice/session') voiceStarts++;
    if (request.url() === origin + '/api/journey/correct') correctionRequests++;
  });
  // Supply the local synthetic file in the browser only; never upload a fixture
  // to production storage or use a physical microphone.
  await page.route(origin + '/voice-test.wav', async route => route.fulfill({ contentType: 'audio/wav', body: await readFile(audio) }));
  // Start synthetic speech only after Listening. File-backed fake capture advances
  // during the handshake and cannot establish whether the opening word was lost.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const buffer = await context.decodeAudioData(await (await fetch('/voice-test.wav')).arrayBuffer());
      window.voiceSample = { ended: false, play() {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        source.onended = () => { window.voiceSample.ended = true; };
        source.start();
      } };
      return destination.stream;
    } });
  });
  page.setDefaultTimeout(40000);
  await page.goto(origin, { waitUntil: 'networkidle' });
  if (production) {
    const headers = (await page.request.get(origin)).headers();
    assert.ok(headers['permissions-policy'].includes('microphone=(self)'));
    for (const [label, value] of Object.entries({ 'Your name': 'Synthetic Voice Test', Company: 'Synthetic Voice Preview',
      'Company website': 'example.com', 'Your role': 'Testing', 'Business email': 'voice-test@example.com' })) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    const saving = page.getByRole('checkbox', { name: /Save my details and estimates/ });
    assert.equal(await saving.isChecked(), false, 'Production tests must not save contact details or estimates.');
    await page.getByRole('button', { name: 'Continue to calculator', exact: true }).click();
    await page.getByRole('note').filter({ hasText: 'Data saving is off.' }).waitFor();
  }
  await page.getByRole('button', { name: 'Paid advertising', exact: true }).click();
  await page.getByRole('button', { name: /^Describe the work/ }).click();
  await page.waitForFunction(() => !document.querySelector('.voice-toggle').disabled);
  const correctionToggle = page.getByRole('checkbox', { name: 'Auto-correct spelling' });
  if (production) { await correctionToggle.waitFor(); await correctionToggle.uncheck(); }
  await page.locator('#description').fill('Existing typed detail.');
  const started = Date.now();
  await page.getByRole('button', { name: 'Start live voice input' }).click();
  await page.getByRole('button', { name: 'Stop voice input' }).waitFor();
  await page.evaluate(() => window.voiceSample.play());
  await page.waitForFunction(() => globalThis.AOCJourney.getState().description.slice('Existing typed detail.'.length).trim().length > 0, null, { timeout: 15000 });
  const partial = await page.locator('#description').inputValue();
  assert.equal(await page.getByRole('button', { name: 'Stop voice input' }).isVisible(), true, 'Words must arrive before stopping.');
  await page.waitForFunction(() => window.voiceSample.ended, null, { timeout: 20000 });
  await page.getByRole('button', { name: 'Stop voice input' }).click();
  await page.getByRole('button', { name: 'Start live voice input' }).waitFor({ timeout: 15000 });
  const final = await page.locator('#description').inputValue();
  assert.ok(final.startsWith('Existing typed detail.'));
  assert.ok(final.slice('Existing typed detail.'.length).trim().length > 0);
  assert.equal(await page.locator('#description').getAttribute('readonly'), null);
  assert.equal(await page.getByRole('alert').count(), 0);
  const firstWord = final.slice('Existing typed detail.'.length).trim().match(/[\p{L}]+/u)?.[0] || '';
  if (expectedFirst) assert.equal(firstWord.toLowerCase(), expectedFirst.toLowerCase(), 'The opening word must be transcribed without repeating it.');
  if (checkCorrection) {
    await correctionToggle.check();
    const typed = 'we need adverstising and weekly reprots. budget is $2500 monthly. only draft replies; do not send them.';
    await page.locator('#description').fill(typed);
    await page.waitForFunction(() => /advertising and weekly reports/.test(document.querySelector('#description').value));
    const corrected = await page.locator('#description').inputValue();
    assert.ok(corrected.includes('$2500 monthly'));
    assert.ok(corrected.includes('only draft replies; do not send them.'));
    await page.getByRole('button', { name: 'Undo correction' }).click();
    assert.equal(await page.locator('#description').inputValue(), typed);
    assert.equal(await correctionToggle.isChecked(), false);
    assert.equal(correctionRequests, 1, 'Keep the production correction check to one paid text request.');
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (production) {
    const status = await (await page.request.get(origin + '/api/access/status')).json();
    assert.equal(status.saveData, false);
    await page.getByRole('button', { name: 'End session', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to calculator', exact: true }).waitFor();
  }
  const result = { passed: true, target: origin, width, submittedRecords: 0, voiceStarts, correctionRequests,
    correctionAndUndoPassed: checkCorrection ? true : null, syntheticAudioOnly: true, speechStartedAfterListening: true,
    elapsedMs: Date.now() - started, providerRequests: production ? null : providerRequests,
    partial, final, firstWord, expectedFirst, liveDeltasBeforeStop: true };
  console.log(JSON.stringify(result));
  await writeFile(`artifacts/live-voice-${production ? 'production' : 'local'}-${width}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `artifacts/live-voice-${production ? 'production' : 'local'}-${width}.png`, fullPage: true });
} catch (error) {
  console.error('Live voice check failed:', error.message);
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      console.log('Voice UI:', await page.locator('.live-voice__status, .helper.error').allTextContents());
      await page.screenshot({ path: 'artifacts/live-voice-provider-error.png', fullPage: true });
    }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  globalThis.fetch = originalFetch;
  if (server.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
