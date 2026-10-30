const buckets = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function calculateJourney(request, url, env) {
  if (request.headers.get('origin') !== url.origin) {
    return json({ error: 'Use this estimator page.' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'JSON required.' }, 415);
  }
  if (Number(request.headers.get('content-length') || 0) > 100000) {
    return json({ error: 'The calculation request is too large.' }, 413);
  }

  try {
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: 'The calculation request is too large.' }, 413);
    const body = JSON.parse(raw);
    const calculation = AOCJourneyCalculation.calculate(body);
    let record;
    if (AOCEstimateRecords.enabled(env)) {
      const session = JSON.parse(new TextDecoder().decode(accessDecodeBase64Url(accessCookie(request).split('.')[0])));
      record = session.saveData !== true ? { saved: false, skipped: true }
        : await AOCEstimateRecords.save(AOCAccessRequests.configuration(env), session.requestId, body, calculation, AOCPricing.version);
    }
    return json({ ...calculation, source: 'server', ...(record ? { record } : {}) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not read the calculation request.' }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/access/status') return accessStatusAPI(request, env);
    if (url.pathname === '/api/access/verify') return accessVerifyAPI(request, env, url);
    if (url.pathname === '/api/access/logout') return accessLogoutAPI(request, url, env);
    if (url.pathname === '/api/access/redeem') return AOCManualAccess.enabled(env)
      ? AOCManualAccess.handle(request, env, 'redeem') : json({ error: 'Not found.' }, 404);

    if (url.pathname === "/api/journey/calculate") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const accessError = await requireWorkerAccess(request, env);
      if (accessError) return accessError;
      return calculateJourney(request, url, env);
    }

    if (url.pathname === "/api/journey/analyze") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const accessError = await requireWorkerAccess(request, env);
      if (accessError) return accessError;
      return journeyAPI(request, env, url);
    }

    if (url.pathname === '/api/intake/status') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const accessError = await requireWorkerAccess(request, env);
      if (accessError) return accessError;
      return json({ configured: Boolean(env.OPENAI_API_KEY) });
    }

    if (url.pathname === '/api/intake/analyze') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      const accessError = await requireWorkerAccess(request, env);
      if (accessError) return accessError;
      return intakeAnalysisAPI(request, env, url);
    }

    if (url.pathname === '/api/intake/transcribe') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      const accessError = await requireWorkerAccess(request, env);
      if (accessError) return accessError;
      return intakeTranscriptionAPI(request, env, url);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }

    const asset = ASSETS[url.pathname === "/" ? "/index.html" : url.pathname];
    if (!asset) return new Response("Not found", { status: 404 });
    const body = asset.binary
      ? Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0))
      : asset.body;
    return new Response(body, { headers: { "content-type": asset.type } });
  },
};
