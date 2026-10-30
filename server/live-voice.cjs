// Server-only WebRTC handshake, shared by Node/Vercel and the retained Worker.
(function (root, factory) {
  const bank = typeof module === 'object' && module.exports ? require('../public/approved-bank.js') : root.AOCBank;
  const api = factory(bank);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOCLiveVoice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (bank) {
  let attempts = 0;
  let windowStart = Date.now();
  const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  async function handle(request, environment) {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const enabled = environment.AOC_VOICE_ENABLED === 'true';
    const configured = enabled && Boolean(environment.OPENAI_API_KEY);
    if (request.method === 'GET') return json({ enabled, configured, maxSeconds: 120 });
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Use this estimator page.' }, 403);
    if (!configured) return json({ error: 'Live voice is unavailable. You can still type your description.' }, 503);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
    if (Number(request.headers.get('content-length') || 0) > 65536) return json({ error: 'Voice connection request is too large.' }, 413);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 65536) return json({ error: 'Voice connection request is too large.' }, 413);
      body = JSON.parse(raw);
    } catch { return json({ error: 'Could not read the voice request.' }, 400); }
    const area = bank.areas.find(item => item.id === body?.area);
    if (!area || typeof body.sdp !== 'string' || !/^v=0\r?\n/u.test(body.sdp) || !/^m=audio /mu.test(body.sdp)) {
      return json({ error: 'Choose a business area and use the microphone button.' }, 400);
    }
    // Process-local guard, not a distributed quota or a hard session-duration cap.
    if (Date.now() - windowStart > 3600000) { attempts = 0; windowStart = Date.now(); }
    if (++attempts > 12) return json({ error: 'Voice session limit reached. Please type or try again later.' }, 429);
    try {
      const credentials = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + environment.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 60 }, session: {
          type: 'transcription', audio: { input: {
            transcription: { model: 'gpt-live-transcribe', delay: 'medium',
              prompt: 'A prospective client describing their ' + area.label + ' work for an AI Commerce estimate.' },
            noise_reduction: { type: 'near_field' }, turn_detection: null,
          } },
        } }),
        signal: AbortSignal.timeout(15000),
      });
      if (!credentials.ok) return json({ error: 'Could not start live voice. Your typed description is preserved.' }, credentials.status === 429 ? 429 : 502);
      const credential = await credentials.json();
      if (typeof credential.value !== 'string' || !credential.value) throw new Error('invalid_credential');
      const form = new FormData();
      form.set('sdp', body.sdp);
      const call = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST', headers: { Authorization: 'Bearer ' + credential.value }, body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!call.ok) return json({ error: 'Could not connect live voice. Your typed description is preserved.' }, call.status === 429 ? 429 : 502);
      const sdp = await call.text();
      if (!/^v=0\r?\n/u.test(sdp) || sdp.length > 100000) throw new Error('invalid_answer');
      // Neither the project key nor the ephemeral credential leaves this server.
      return json({ sdp, maxSeconds: 120 });
    } catch { return json({ error: 'Live voice could not connect. Your typed description is preserved; please retry or type.' }, 502); }
  }
  return { handle };
});
