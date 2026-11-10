// Shared by Node and the retained Worker. Never send the secret or tokens to storage.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOCRecaptcha = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const action = 'calculator_entry';
  const unavailable = 'The security check is temporarily unavailable. Your details are still here; please try again.';
  const rejected = 'We could not verify this submission. Your details are still here; please try again.';
  function configuration(env) {
    const siteKey = String(env.VITE_RECAPTCHA_SITE_KEY || '').trim();
    const secret = String(env.RECAPTCHA_SECRET_KEY || '').trim();
    const enabled = env.AOC_RECAPTCHA_ENABLED !== 'false'
      && (env.AOC_RECAPTCHA_ENABLED === 'true' || Boolean(siteKey || secret));
    const version = String(env.RECAPTCHA_VERSION || 'v3').trim();
    const minimumScore = Number(env.RECAPTCHA_MIN_SCORE || '0.5');
    return { enabled, version, siteKey, secret, minimumScore,
      configured: Boolean(siteKey && secret && (version === 'v2' || version === 'v3')
        && (version === 'v2' || (Number.isFinite(minimumScore) && minimumScore >= 0 && minimumScore <= 1))) };
  }
  function status(env) {
    const config = configuration(env);
    return config.enabled ? { recaptcha: { enabled: true, configured: config.configured, version: config.version, siteKey: config.siteKey, action } } : {};
  }
  const error = (message, code) => Response.json({ error: message }, {
    status: code, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
  async function verify(request, env, token) {
    const config = configuration(env);
    if (!config.enabled) return null;
    if (!config.configured) return error(unavailable, 503);
    if (typeof token !== 'string' || !token.trim() || token.length > 8192) return error(rejected, 403);
    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: config.secret, response: token }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return error(unavailable, 503);
      const data = await response.json();
      const age = Date.now() - Date.parse(data.challenge_ts);
      if (data.success !== true || data.error || data['error-codes']?.length
        || data.hostname !== new URL(request.url).hostname || !Number.isFinite(age) || age < -30000) return error(rejected, 403);
      if (config.version === 'v3' && (data.action !== action
        || typeof data.score !== 'number' || !Number.isFinite(data.score) || data.score < config.minimumScore || data.score > 1
        || age > 120000)) return error(rejected, 403);
      // v2 challenge_ts is the challenge's load time, not the solve time. Google
      // enforces the response token's two-minute expiry and single use itself.
      if (config.version === 'v2' && (data.score !== undefined || data.action !== undefined)) return error(rejected, 403);
      return null;
    } catch { return error(unavailable, 503); }
  }
  return { configuration, status, verify };
});
