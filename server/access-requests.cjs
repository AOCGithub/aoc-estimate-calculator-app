// Server-only: shared by Vercel, local development and the retained Worker.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOCAccessRequests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function configuration(environment) {
    const enabled = environment.AOC_ACCESS_REQUESTS_ENABLED === 'true';
    const key = String(environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    let url = '';
    try {
      const parsed = new URL(environment.SUPABASE_URL);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
        url = parsed.origin;
      }
    } catch { /* Missing server configuration must fail closed. */ }
    return { enabled, configured: Boolean(url && key), url, key };
  }

  async function save(configuration, profile, requestId = null) {
    if (!configuration.enabled || !configuration.configured) throw new Error('Access request storage is unavailable.');
    const response = await fetch(configuration.url + '/rest/v1/access_requests', {
      method: 'POST',
      headers: {
        apikey: configuration.key,
        ...(configuration.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + configuration.key }),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ...(requestId ? { id: requestId } : {}),
        name: profile.name,
        company: profile.company,
        website: profile.website,
        role: profile.role,
        business_email: profile.businessEmail,
        review_status: 'pending',
      }),
      signal: AbortSignal.timeout(8000),
    });
    // Do not log or return provider responses: they may contain personal details.
    if (!response.ok) throw new Error('Access request storage is unavailable.');
  }

  return { configuration, save };
});
