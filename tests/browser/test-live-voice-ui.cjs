const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const Correction = require('../../server/description/description-correction.cjs');

const root = path.resolve(__dirname, '../../dist/client');
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(file => file && fs.existsSync(file));
if (!executablePath) throw new Error('A Chromium browser is required for live-voice UI tests.');
let starts = 0;
let enabled = true;
let connectionError = false;
let correctionConfigured = false, correctionDelay = 0, correctionFailure = false, correctionCalls = 0;
const correctionSources = [];
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  if (pathname === '/api/journey/correct') {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') return response.end(JSON.stringify({ configured: correctionConfigured }));
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      correctionCalls++;
      const { text, source } = JSON.parse(raw);
      assert.ok(['typed', 'voice'].includes(source));
      correctionSources.push(source);
      const result = Correction.validate(text, { edits: [
        { before: 'adverstising', after: 'advertising', kind: 'typo' },
        { before: 'reprots', after: 'reports', kind: 'typo' },
        { before: 'lead routing', after: 'lead scoring', kind: 'unclear' },
        { before: 'Testem', after: 'Testing', kind: 'unclear' },
        { before: 'we use Meta Shopify and Google Sheets', after: 'we use Meta, Shopify, and Google Sheets.', kind: 'punctuation' },
      ] });
      setTimeout(() => response.writeHead(correctionFailure ? 503 : 200).end(JSON.stringify(correctionFailure ? { error: 'Synthetic failure.' } : result)), correctionDelay);
    });
    return;
  }
  if (pathname === '/api/voice/session') {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') return response.end(JSON.stringify({ enabled, configured: enabled }));
    let raw = '';
    request.on('data', data => { raw += data; });
    request.on('end', () => {
      const body = JSON.parse(raw);
      assert.deepEqual(Object.keys(body).sort(), ['area', 'context', 'sdp']);
      starts++;
      if (connectionError) return response.writeHead(502).end(JSON.stringify({ error: 'Could not connect live voice. Your typed description is preserved.' }));
      response.end(JSON.stringify({ sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', maxSeconds: 120 }));
    });
    return;
  }
  const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)];
    response.writeHead(200, { 'Content-Type': contentType || 'application/octet-stream' }).end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});

function fakeDevices() {
  const fixture = { mode: 'allow', streams: [], peers: [], offset: 0, sessionType: 'transcription', connectionState: 'connected' };
  window.voiceFixture = fixture;
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + fixture.offset;
  function stream() {
    const track = { enabled: true, stopped: false, onended: null, stop() { this.stopped = true; } };
    const value = { getTracks: () => [track], getAudioTracks: () => [track] };
    fixture.streams.push(value);
    return value;
  }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    async getUserMedia() {
      if (fixture.mode === 'deny') throw new DOMException('Synthetic permission refusal', 'NotAllowedError');
      if (fixture.mode === 'missing') throw new DOMException('Synthetic missing microphone', 'NotFoundError');
      if (fixture.mode === 'busy') throw new DOMException('Synthetic busy microphone', 'NotReadableError');
      if (fixture.mode === 'pending') return new Promise(resolve => { fixture.grant = () => resolve(stream()); });
      return stream();
    },
  } });
  class Channel {
    constructor() { this.readyState = 'connecting'; this.sent = []; }
    send(value) {
      if (fixture.sendFailure) throw new DOMException('Synthetic closed transport', 'InvalidStateError');
      this.sent.push(JSON.parse(value));
    }
    close() { this.readyState = 'closed'; this.onclose?.(); }
  }
  window.RTCPeerConnection = class {
    constructor() { fixture.peers.push(this); this.connectionState = 'new'; }
    addTrack() {}
    createDataChannel() { this.channel = new Channel(); fixture.channel = this.channel; return this.channel; }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' }; }
    async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription() {
      this.connectionState = fixture.connectionState; this.channel.readyState = 'open';
      this.channel.onmessage?.({ data: JSON.stringify({ type: 'session.created', session: { type: fixture.sessionType } }) });
    }
    close() { this.connectionState = 'closed'; this.onconnectionstatechange?.(); }
  };
  fixture.emit = value => fixture.channel.onmessage?.({ data: JSON.stringify(value) });
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(fakeDevices);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      async function openDescription() {
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'Paid advertising', exact: true }).click();
        await page.getByRole('button', { name: /^Describe the work/ }).click();
        await page.waitForFunction(() => !document.querySelector('.voice-toggle').disabled);
      }
      async function start() {
        await page.getByRole('button', { name: 'Start live voice input' }).click();
        await page.getByRole('button', { name: 'Stop voice input' }).waitFor();
      }
      const emit = value => page.evaluate(event => window.voiceFixture.emit(event), value);
      async function finalize(transcript) {
        await page.waitForFunction(() => window.voiceFixture.channel.sent.some(event => event.type === 'input_audio_buffer.commit'));
        await emit({ type: 'input_audio_buffer.committed', item_id: 'turn1', previous_item_id: null });
        await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'turn1', transcript });
        await page.getByRole('button', { name: 'Start live voice input' }).waitFor();
      }
      await openDescription();
      await page.evaluate(() => { window.voiceFixture.connectionState = 'connecting'; });
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.waitForFunction(() => window.voiceFixture.channel?.readyState === 'open');
      await page.waitForTimeout(500);
      assert.equal(await page.getByRole('button', { name: 'Stop voice input' }).count(), 0, 'Session metadata alone cannot announce Listening.');
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].enabled), false);
      await page.evaluate(() => { const peer = window.voiceFixture.peers.at(-1); peer.connectionState = 'connected'; peer.onconnectionstatechange(); });
      await page.getByRole('status').filter({ hasText: 'Preparing your microphone' }).waitFor();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].enabled), true);
      await page.getByRole('button', { name: 'Cancel voice connection' }).click();
      await page.waitForTimeout(500);
      assert.equal(await page.getByRole('button', { name: 'Stop voice input' }).count(), 0, 'Cancelling preparation cannot re-enable capture later.');
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      await page.evaluate(() => { window.voiceFixture.connectionState = 'connected'; });
      await page.locator('#description').fill('Existing typed details.');
      await start();
      assert.equal(await page.locator('#description').getAttribute('readonly'), '');
      assert.equal(await page.getByRole('button', { name: /Organize my description/ }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: /Continue with editable fields/ }).isDisabled(), true);
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', event_id: 'delta1', delta: 'Draft adds on Metta' });
      assert.equal(await page.locator('#description').inputValue(), 'Existing typed details.\n\nDraft adds on Metta');
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', event_id: 'delta1', delta: 'Draft adds on Metta' });
      assert.equal(await page.locator('#description').inputValue(), 'Existing typed details.\n\nDraft adds on Metta');
      await page.getByRole('button', { name: 'Stop voice input' }).click();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      await finalize('Draft ads on Meta.');
      assert.equal(await page.locator('#description').inputValue(), 'Existing typed details.\n\nDraft ads on Meta.');
      await page.locator('#description').fill('Manual correction after voice.');
      assert.equal(await page.getByRole('button', { name: /Organize my description/ }).isEnabled(), true);

      // A final for an earlier turn cannot finish recording before Stop's commit.
      await start();
      await emit(null);
      await page.evaluate(() => window.voiceFixture.channel.onmessage({ data: 'not JSON' }));
      await emit({ type: 'input_audio_buffer.committed', item_id: 'earlier', previous_item_id: null });
      await page.evaluate(() => {
        document.querySelector('.voice-toggle').click();
        window.voiceFixture.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'earlier', transcript: 'Earlier words.' });
      });
      assert.equal(await page.getByRole('button', { name: 'Keep captured text' }).count(), 1);
      await page.waitForFunction(() => window.voiceFixture.channel.sent.length > 0);
      await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'latest', transcript: 'Latest words.' });
      assert.equal(await page.getByRole('button', { name: 'Keep captured text' }).count(), 1, 'Wait for the matching committed item, even if its final arrives first.');
      await emit({ type: 'input_audio_buffer.committed', item_id: 'latest', previous_item_id: 'earlier' });
      await page.getByRole('button', { name: 'Start live voice input' }).waitFor();
      assert.equal(await page.locator('#description').inputValue(), 'Manual correction after voice.\n\nEarlier words. Latest words.');

      await page.locator('#description').fill('Keep my existing details.');
      await start();
      await page.getByRole('button', { name: 'Stop voice input' }).click();
      await finalize('');
      await page.getByRole('status').filter({ hasText: 'No words were captured' }).waitFor();
      assert.equal(await page.locator('#description').inputValue(), 'Keep my existing details.');
      assert.equal(await page.locator('#description').getAttribute('readonly'), null);

      await start();
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', delta: 'Keep partial words.' });
      await page.evaluate(() => { window.voiceFixture.sendFailure = true; });
      await page.getByRole('button', { name: 'Stop voice input' }).click();
      await page.getByRole('status').filter({ hasText: 'could not finish sending' }).waitFor();
      assert.ok((await page.locator('#description').inputValue()).endsWith('Keep partial words.'));
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      await page.evaluate(() => { window.voiceFixture.sendFailure = false; });

      await start();
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', delta: 'Preserve on timeout.' });
      await page.getByRole('button', { name: 'Stop voice input' }).click();
      await page.getByRole('status').filter({ hasText: 'Final confirmation timed out' }).waitFor({ timeout: 15000 });
      assert.ok((await page.locator('#description').inputValue()).endsWith('Preserve on timeout.'));
      assert.equal(await page.locator('#description').getAttribute('readonly'), null);

      await start();
      await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].onended());
      await page.getByRole('status').filter({ hasText: 'Microphone stopped' }).waitFor();
      assert.equal(await page.evaluate(() => window.voiceFixture.peers.at(-1).connectionState), 'closed');
      await start();
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      await page.getByRole('status').filter({ hasText: 'left this tab' }).waitFor();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);

      await page.locator('#description').fill('x'.repeat(17990));
      await start();
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', delta: 'More words than fit.' });
      await page.getByRole('button', { name: 'Keep captured text' }).waitFor();
      await finalize('More words than fit.');
      assert.equal((await page.locator('#description').inputValue()).length, 18000);
      assert.equal(await page.getByRole('button', { name: 'Start live voice input' }).isDisabled(), true);
      assert.equal(await page.locator('#description').getAttribute('readonly'), null);
      await page.getByRole('status').filter({ hasText: 'Description limit reached' }).waitFor();
      await page.locator('#description').fill('Manual correction after voice.');

      const beforeDenied = starts;
      for (const mode of ['missing', 'busy']) {
        await page.evaluate(value => { window.voiceFixture.mode = value; }, mode);
        await page.getByRole('button', { name: 'Start live voice input' }).click();
        await page.getByRole('alert').filter({ hasText: 'microphone is unavailable' }).waitFor();
        assert.equal(starts, beforeDenied, 'An unavailable device must not create a paid session.');
      }
      await page.evaluate(() => { window.voiceFixture.mode = 'deny'; });
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.getByRole('alert').filter({ hasText: 'permission was denied' }).waitFor();
      assert.equal(starts, beforeDenied, 'Permission refusal must not create a provider session.');
      assert.equal(await page.locator('#description').inputValue(), 'Manual correction after voice.');
      await page.evaluate(() => { window.voiceFixture.mode = 'pending'; });
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.getByRole('button', { name: 'Cancel voice connection' }).click();
      await page.evaluate(() => window.voiceFixture.grant());
      await page.waitForFunction(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped);
      assert.equal(starts, beforeDenied, 'Late microphone permission after cancellation cannot start a session.');

      await page.evaluate(() => { window.voiceFixture.mode = 'allow'; });
      connectionError = true;
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.getByRole('alert').filter({ hasText: 'Could not connect live voice. Your typed description is preserved.' }).waitFor();
      assert.equal(await page.locator('#description').inputValue(), 'Manual correction after voice.');
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      connectionError = false;
      await page.evaluate(() => { window.voiceFixture.sessionType = 'realtime'; });
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.getByRole('alert').filter({ hasText: 'could not be verified' }).waitFor();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].enabled), false, 'An unverified session must not send microphone audio.');
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      await page.evaluate(() => { window.voiceFixture.sessionType = 'transcription'; });
      await start();
      await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'turn1', delta: 'Captured before disconnect.' });
      await page.evaluate(() => { const peer = window.voiceFixture.peers.at(-1); peer.connectionState = 'failed'; peer.onconnectionstatechange(); });
      await page.getByRole('alert').filter({ hasText: 'connection lost' }).waitFor();
      assert.ok((await page.locator('#description').inputValue()).includes('Captured before disconnect.'));
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);

      await start();
      await page.evaluate(() => { window.voiceFixture.oldCallback = window.voiceFixture.channel.onmessage; });
      if (width < 700) await page.locator('#section-picker').selectOption('3');
      else await page.getByRole('button', { name: /^3 Process and scope/ }).click();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      const beforeLate = await page.evaluate(() => globalThis.AOCJourney.getState().description);
      await page.evaluate(() => window.voiceFixture.oldCallback({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late', transcript: 'Must not overwrite.' }) }));
      assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().description), beforeLate);
      if (width < 700) await page.locator('#section-picker').selectOption('2');
      else await page.getByRole('button', { name: /^2 Describe the work/ }).click();
      await page.waitForFunction(() => !document.querySelector('.voice-toggle').disabled);
      await start();
      await page.evaluate(() => { window.voiceFixture.offset = 121000; });
      await page.getByRole('button', { name: 'Keep captured text' }).waitFor();
      await finalize('Another sentence.');
      await page.evaluate(() => { window.voiceFixture.offset = 0; });
      await start();
      await page.evaluate(() => { window.voiceFixture.oldCallback = window.voiceFixture.channel.onmessage; });
      await page.locator('#restart').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Start over', exact: true }).click();
      await page.locator('.area').first().waitFor();
      assert.equal(await page.evaluate(() => window.voiceFixture.streams.at(-1).getTracks()[0].stopped), true);
      await page.evaluate(() => window.voiceFixture.oldCallback({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late', transcript: 'Must stay reset.' }) }));
      assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().description), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS: ${width}px live/final ordering, silence, malformed messages, send failure, final timeout, missing/busy/denied microphones, device removal, background-tab cleanup, text preservation, navigation/reset, timer limit and mobile layout.`);
    }
    correctionConfigured = true;
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(fakeDevices);
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Paid advertising', exact: true }).click();
      await page.getByRole('button', { name: /^Describe the work/ }).click();
      const description = page.locator('#description');
      const toggle = page.getByRole('checkbox', { name: 'Auto-correct spelling' });
      await toggle.waitFor();
      const original = 'we need adverstising and reprots for Qorvex. budget $2500 monthly; only draft replies, do not send them.';
      const corrected = original.replace('adverstising', 'advertising').replace('reprots', 'reports');
      await description.fill(original);
      await description.evaluate(element => { element.setSelectionRange(20, 20); });
      await page.waitForFunction(text => document.querySelector('#description').value === text, corrected);
      // The correction restores the caret on the next animation frame after React updates the value.
      await page.waitForFunction(() => document.querySelector('#description').selectionStart === 19);
      assert.equal(correctionSources.at(-1), 'typed');
      assert.equal(await description.evaluate(element => element.selectionStart), 19, 'Caret tracks a shorter corrected word.');
      assert.equal(await description.evaluate(element => element.spellcheck), true);
      await page.getByRole('button', { name: 'Undo correction' }).click();
      assert.equal(await description.inputValue(), original);
      await page.getByRole('status').filter({ hasText: 'Original wording restored. Auto-correct is paused.' }).waitFor();
      assert.equal(await toggle.isChecked(), false, 'Undo pauses automatic changes so a manual override is kept.');
      const afterUndo = correctionCalls;
      await page.waitForTimeout(2100);
      assert.equal(correctionCalls, afterUndo);
      await description.fill('we need lead routing for our store.');
      await toggle.check();
      await page.getByText('Please check “lead routing”', { exact: false }).waitFor();
      assert.equal(await description.inputValue(), 'we need lead routing for our store.', 'Uncertain wording is a suggestion, never silently applied.');
      await description.fill('Testem one two three');
      await page.getByRole('button', { name: 'Use suggested wording: Testing', exact: true }).waitFor();
      assert.equal(await description.inputValue(), 'Testem one two three');
      await page.getByRole('button', { name: 'Use suggested wording: Testing', exact: true }).click();
      assert.equal(await description.inputValue(), 'Testing one two three');
      await page.getByRole('button', { name: 'Undo correction' }).click();
      assert.equal(await description.inputValue(), 'Testem one two three');
      await toggle.check();

      const beforeComposition = correctionCalls;
      await description.dispatchEvent('compositionstart');
      await description.fill('we need adverstising and reprots.');
      await page.waitForTimeout(2100);
      assert.equal(correctionCalls, beforeComposition, 'IME composition is not interrupted.');
      await description.dispatchEvent('compositionend');
      await page.waitForFunction(() => document.querySelector('#description').value === 'we need advertising and reports.');
      assert.equal(correctionSources.at(-1), 'typed');
      await description.fill('we use Meta Shopify and Google Sheets');
      await page.waitForFunction(() => document.querySelector('#description').value === 'we use Meta, Shopify, and Google Sheets.');
      assert.equal(await description.evaluate(element => element.selectionStart), 'we use Meta, Shopify, and Google Sheets.'.length);

      correctionDelay = 2500;
      await description.fill('adverstising before more typing.');
      await page.getByRole('status').filter({ hasText: 'Checking spelling' }).waitFor();
      await description.fill('New manual wording must stay.');
      await page.waitForTimeout(5000);
      assert.equal(await description.inputValue(), 'New manual wording must stay.', 'A late correction cannot overwrite newer typing.');
      correctionDelay = 0;
      correctionFailure = true;
      await description.fill('adverstising during an outage.');
      await page.getByRole('status').filter({ hasText: 'Spelling check is unavailable' }).waitFor();
      assert.equal(await description.inputValue(), 'adverstising during an outage.');
      assert.equal(await page.getByRole('button', { name: /Continue with editable fields/ }).isEnabled(), true);
      correctionFailure = false;

      // The same automatic check runs only after the voice session has finished.
      await description.fill('');
      const beforeSpeaking = correctionCalls;
      await page.getByRole('button', { name: 'Start live voice input' }).click();
      await page.getByRole('button', { name: 'Stop voice input' }).waitFor();
      await page.evaluate(() => window.voiceFixture.emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'spoken', delta: 'we need adverstising and reprots.' }));
      await page.waitForTimeout(2100);
      assert.equal(correctionCalls, beforeSpeaking, 'No proofreading requests while speech is streaming.');
      await page.getByRole('button', { name: 'Stop voice input' }).click();
      await page.waitForFunction(() => window.voiceFixture.channel.sent.some(event => event.type === 'input_audio_buffer.commit'));
      await page.evaluate(() => {
        window.voiceFixture.emit({ type: 'input_audio_buffer.committed', item_id: 'spoken' });
        window.voiceFixture.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'spoken', transcript: 'we need adverstising and reprots.' });
      });
      await page.waitForFunction(() => document.querySelector('#description').value === 'we need advertising and reports.');
      assert.equal(correctionSources.at(-1), 'voice', 'Final speech must request voice-specific cleanup, not typed-name correction.');

      correctionDelay = 2500;
      await description.fill('adverstising before leaving this section.');
      await page.getByRole('status').filter({ hasText: 'Checking spelling' }).waitFor();
      if (width < 700) await page.locator('#section-picker').selectOption('3');
      else await page.getByRole('button', { name: /^3 Process and scope/ }).click();
      await page.waitForTimeout(3000);
      assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().description), 'adverstising before leaving this section.');
      await page.locator('#restart').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Start over', exact: true }).click();
      assert.equal(await page.evaluate(() => globalThis.AOCJourney.getState().description), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      correctionDelay = 0;
      await context.close();
      console.log(`PASS: ${width}px automatic typed/voice spelling, caret, undo/pause, uncertain wording, IME, newer edits, failure recovery, navigation/reset and unchanged facts.`);
    }
    const insecureContext = await browser.newContext();
    await insecureContext.route('http://voice-local.test/**', async route => {
      const url = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) });
    });
    const insecurePage = await insecureContext.newPage();
    await insecurePage.goto('http://voice-local.test/', { waitUntil: 'networkidle' });
    await insecurePage.getByRole('button', { name: 'Paid advertising', exact: true }).click();
    await insecurePage.getByRole('button', { name: /^Describe the work/ }).click();
    assert.equal(await insecurePage.evaluate(() => isSecureContext), false);
    await insecurePage.getByRole('status').filter({ hasText: 'Microphone access needs HTTPS.' }).waitFor();
    assert.equal(await insecurePage.getByRole('button', { name: 'Start live voice input' }).isDisabled(), true);
    await insecurePage.locator('#description').fill('Typing still works on an unsecured local address.');
    assert.equal(await insecurePage.getByRole('button', { name: /Continue with editable fields/ }).isEnabled(), true);
    await insecureContext.close();
    console.log('PASS: Unsecured HTTP address explains the HTTPS/localhost requirement and preserves typing.');
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
