// Server-only persistence; no public read or caller-selected ownership endpoint.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOCEstimateRecords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function enabled(environment) {
    return environment.AOC_ESTIMATE_RECORDS_ENABLED === 'true'
      && environment.AOC_ACCESS_GATE_ENABLED === 'true'
      && environment.AOC_INTAKE_ONLY_ENABLED === 'true';
  }
  function validId(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
  async function save(configuration, requestId, body, calculation, pricingVersion) {
    try {
      if (!configuration.enabled || !configuration.configured || !validId(requestId)) throw new Error('unavailable');
      const response = await fetch(configuration.url + '/rest/v1/estimates', {
        method: 'POST',
        headers: {
          apikey: configuration.key,
          ...(configuration.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + configuration.key }),
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ access_request_id: requestId, business_area: body.area,
          answers: body.answers, scope_confirmed: body.confirmed, result: calculation.result,
          calculator_version: calculation.version, pricing_version: pricingVersion }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('unavailable');
      return { saved: true };
    } catch {
      return { saved: false, error: 'Your estimate was calculated, but could not be saved. Please calculate again to retry.' };
    }
  }
  return { enabled, validId, save };
});
