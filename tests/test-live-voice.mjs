import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { handleLiveVoice, handleAccessVerification } from '../server/api-handlers.mjs';
import { createLiveTranscript } from '../src/lib/liveTranscript.mjs';

const text = createLiveTranscript('Existing text.');
text.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'b', event_id: '1', delta: 'twnty dollars' });
text.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'b', event_id: '1', delta: 'twnty dollars' });
assert.equal(text.text(), 'Existing text.\n\ntwnty dollars');
text.update({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'b', transcript: 'Twenty dollars.' });
text.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'b', delta: 'stale' });
text.update({ type: 'input_audio_buffer.committed', item_id: 'b', previous_item_id: 'a' });
text.update({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'First sentence.' });
assert.equal(text.text(), 'Existing text.\n\nFirst sentence. Twenty dollars.');
assert.equal(text.completed('b'), true);
const bounded = createLiveTranscript('12345', 8);
bounded.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: '1', delta: 'long transcript' });
assert.equal(bounded.text().length, 8);

const settings = { AOC_VOICE_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-company-key', AOC_ACCESS_GATE_ENABLED: 'true',
  AOC_APPROVED_EMAILS: '["voice@example.test"]', AOC_ACCESS_SESSION_SECRET: 'synthetic-session-secret-over-32-characters' };
const offer = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
let mode = 'ok'; let calls = 0;
const originalFetch = globalThis.fetch;
async function provider(url, options) {
  calls++;
  if (url.endsWith('/client_secrets')) {
    assert.equal(options.headers.Authorization, 'Bearer ' + settings.OPENAI_API_KEY);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.expires_after, { anchor: 'created_at', seconds: 60 });
    assert.equal(body.session.type, 'transcription');
    assert.equal(body.session.audio.input.transcription.model, 'gpt-live-transcribe');
    assert.equal(body.session.audio.input.transcription.delay, 'medium');
    assert.equal(body.session.audio.input.turn_detection, null);
    assert.ok(!JSON.stringify(body).includes('client-model'));
    if (mode === 'secret_fail') return Response.json({ error: 'private-provider-details' }, { status: 401 });
    if (mode === 'quota') return Response.json({ error: 'private-provider-details' }, { status: 429 });
    return Response.json({ value: 'ek_synthetic_short_lived', expires_at: 9999999999 });
  }
  assert.equal(url, 'https://api.openai.com/v1/realtime/calls');
  assert.equal(options.headers.Authorization, 'Bearer ek_synthetic_short_lived');
  assert.equal(options.body.get('sdp'), offer);
  assert.equal(options.body.get('session'), null, 'Use the server-created transcription credential, not client-selected session options.');
  if (mode === 'call_fail') return Response.json({ error: 'private-provider-details' }, { status: 500 });
  return new Response(mode === 'bad_sdp' ? 'private-provider-details' : offer);
}
function request(body, cookie = '', origin = 'https://voice.test', method = body === undefined ? 'GET' : 'POST') {
  return new Request('https://voice.test/api/voice/session', { method,
    headers: { origin, cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function exercise(dispatch, cookie) {
  mode = 'ok'; calls = 0;
  assert.equal((await dispatch(request())).status, 401);
  let result = await dispatch(request(undefined, cookie));
  assert.deepEqual(await result.json(), { enabled: true, configured: true, maxSeconds: 120 });
  result = await dispatch(request(undefined, cookie), { ...settings, AOC_VOICE_ENABLED: 'false' });
  assert.equal((await result.json()).enabled, false);
  assert.equal((await dispatch(request({ area: 'area10', sdp: offer }, cookie), { ...settings, OPENAI_API_KEY: '' })).status, 503);
  assert.equal((await dispatch(request({ area: 'area10', sdp: offer }, cookie, 'https://elsewhere.test'))).status, 403);
  assert.equal((await dispatch(request({ area: 'area10', sdp: 'invalid' }, cookie))).status, 400);
  assert.equal((await dispatch(request({ area: 'invalid', sdp: offer }, cookie))).status, 400);
  assert.equal((await dispatch(request({ area: 'area10', sdp: offer + 'x'.repeat(65536) }, cookie))).status, 413);
  assert.equal((await dispatch(request(undefined, cookie, 'https://voice.test', 'DELETE'))).status, 405);
  assert.equal(calls, 0);
  for (const [scenario, expected] of [['secret_fail', 502], ['quota', 429], ['call_fail', 502], ['bad_sdp', 502], ['ok', 200]]) {
    mode = scenario;
    result = await dispatch(request({ area: 'area10', sdp: offer, model: 'client-model', session: { type: 'realtime' } }, cookie));
    assert.equal(result.status, expected, scenario);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const body = await result.text();
    assert.ok(!/synthetic-company-key|ek_synthetic|private-provider-details/u.test(body));
    if (scenario === 'ok') assert.equal(JSON.parse(body).sdp, offer);
  }
  mode = 'ok';
  for (let i = 0; i < 15; i++) result = await dispatch(request({ area: 'area10', sdp: offer }, cookie));
  assert.equal(result.status, 429, 'Session starts are bounded by a process-local guard.');
}
try {
  globalThis.fetch = provider;
  const response = await handleAccessVerification(new Request('https://voice.test/api/access/verify', { method: 'POST',
    headers: { origin: 'https://voice.test', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Voice Test',
      company: 'Example Company', role: 'Testing', website: 'example.com', businessEmail: 'voice@example.test' }) }), settings);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  await exercise((request, environment = settings) => handleLiveVoice(request, environment), cookie);
  const source = await readFile(new URL('../dist/server/index.js', import.meta.url), 'utf8');
  const context = vm.createContext({ Request, Response, Blob, FormData, URL, AbortSignal, crypto: webcrypto,
    atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout, console, fetch: provider });
  vm.runInContext(source.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
  await exercise((request, environment = settings) => context.worker.fetch(request, environment), cookie);
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
  assert.ok(config.headers.some(rule => rule.headers.some(header => header.key === 'Permissions-Policy'
    && header.value.includes('microphone=(self)') && header.value.includes('camera=()') && header.value.includes('geolocation=()'))));
  console.log('PASS: Live/final transcript reconciliation, bounded text, private transcription-only setup, access/origin/method/size guards, failures, rate guard, Node/Worker parity and same-origin microphone policy. No paid calls.');
} finally { globalThis.fetch = originalFetch; }
