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
    const minimumScore = Number(env.RECAPTCHA_MIN_SCORE || '0.5');
    return { enabled, siteKey, secret, minimumScore,
      configured: Boolean(siteKey && secret && Number.isFinite(minimumScore) && minimumScore >= 0 && minimumScore <= 1) };
  }
  function status(env) {
    const config = configuration(env);
    return config.enabled ? { recaptcha: { enabled: true, configured: config.configured, siteKey: config.siteKey, action } } : {};
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
        || data.action !== action || data.hostname !== new URL(request.url).hostname
        || typeof data.score !== 'number' || !Number.isFinite(data.score) || data.score < config.minimumScore || data.score > 1
        || !Number.isFinite(age) || age < -30000 || age > 120000) return error(rejected, 403);
      return null;
    } catch { return error(unavailable, 503); }
  }
  return { configuration, status, verify };
});
