const buckets = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function calculateJourney(request, url) {
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
    const calculation = AOCJourneyCalculation.calculate(JSON.parse(raw));
    return json({ ...calculation, source: 'server' });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not read the calculation request.' }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/journey/calculate") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return calculateJourney(request, url);
    }

    if (url.pathname === "/api/journey/analyze") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return journeyAPI(request, env, url);
    }

    if (url.pathname === '/api/intake/status') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      return json({ configured: Boolean(env.OPENAI_API_KEY) });
    }

    if (url.pathname === '/api/intake/analyze') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      return intakeAnalysisAPI(request, env, url);
    }

    if (url.pathname === '/api/intake/transcribe') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
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
