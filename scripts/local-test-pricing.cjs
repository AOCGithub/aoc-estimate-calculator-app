// Isolated loopback-only preview. Never writes synthetic values into public/ or data/.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const fixture = require('../tests/fixtures/local-test-pricing.json');
const projectRoot = path.resolve(__dirname, '..');
const clientRoot = path.join(projectRoot, 'dist/client');

function createTestPricing() {
  if (fixture.testOnly !== true) throw Error('Synthetic fixture must be explicitly marked test-only.');
  const pricing = structuredClone(require('../public/approved-pricing.js'));
  pricing.version += '-synthetic-local';
  pricing.commercial.version = pricing.version;
  pricing.commercial.supportPrices = structuredClone(fixture.supportPrices);
  pricing.commercial.notice = `${fixture.label}. Example amounts are for local calculation testing only; they are not a quote or agreed allowance.`;
  for (const [tier, price] of Object.entries(fixture.supportPrices)) {
    if (!pricing.commercial.supportTiers.includes(tier) || !Number.isFinite(price) || price <= 0) throw Error('Invalid synthetic support fixture.');
  }
  for (const [plan, proposal] of Object.entries(fixture.monthlyProposals)) {
    if (!(proposal.hours > 0 && proposal.blend > 0) || proposal.hours * proposal.blend !== pricing.commercial.monthlyPlans[plan]) throw Error('Synthetic proposal must reconcile with its program fee.');
  }
  const context = vm.createContext({ structuredClone, AOCPricing: pricing });
  for (const filename of ['engine.js', 'approved-bank.js', 'commercial.js', 'journey-engine.js', 'journey-contract.js', 'journey-calculation.js']) {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, 'public', filename), 'utf8'), context, { filename });
  }
  context.AOCBank.version = pricing.version;
  return { pricing, bank: context.AOCBank, calculate: body => context.AOCJourneyCalculation.calculate(body) };
}

function banner() {
  const tiers = Object.entries(fixture.supportPrices).map(([tier, fee]) => `${tier}: $${fee}/month`).join(' | ');
  const plans = Object.entries(fixture.monthlyProposals).map(([plan, proposal]) => `<li>${plan}: ${proposal.hours} sample hours/month at $${proposal.blend}/hour</li>`).join('');
  return `<aside class="test-pricing-banner" role="note" aria-label="Synthetic local pricing"><strong>${fixture.label}</strong><p>Production is unchanged. Support fees in this preview: ${tiers}.</p><details><summary>Sample allowances to enter for a monthly program</summary><ul>${plans}</ul><p>Enter these in section 7, under Agreed monthly proposal details. They are examples, not real agreed hours or a universal agency rate. Blank answers stay unknown; nothing is automatically agreed. Audit and project quotes still need explicit entries. AI uses free local organization here; no key is loaded and no paid AI calls are made.</p></details></aside>`;
}

function createPreviewServer() {
  if (!fs.existsSync(path.join(clientRoot, 'index.html'))) throw Error('Build first with npm run build.');
  const local = createTestPricing();
  const json = (response, status, data) => {
    response.writeHead(status, { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-aoc-test-pricing': 'synthetic-local-only' });
    response.end(JSON.stringify(data));
  };
  const server = http.createServer(async (request, response) => {
    const port = server.address().port;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return json(response, 403, { error: 'Loopback preview only.' });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname); }
    catch { return json(response, 400, { error: 'Invalid path.' }); }
    if (pathname.startsWith('/api/')) {
      if (request.method !== 'POST') return json(response, 405, { error: 'POST required.' });
      if (request.headers.origin !== `http://${request.headers.host}`) return json(response, 403, { error: 'Use the local preview page.' });
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'JSON required.' });
      if (pathname === '/api/journey/analyze') return json(response, 200, { localFallback: true, mode: 'local', testOnly: true });
      if (pathname !== '/api/journey/calculate') return json(response, 404, { error: 'Not available in this local preview.' });
      try {
        const chunks = []; let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 100000) return json(response, 413, { error: 'Request too large.' });
          chunks.push(chunk);
        }
        const calculation = local.calculate(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        return json(response, 200, { ...calculation, source: 'server', testOnly: true });
      } catch (error) { return json(response, 400, { error: error.message }); }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'GET required.' });
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-aoc-test-pricing': 'synthetic-local-only' };
    if (pathname === '/approved-pricing.js' || pathname === '/approved-bank.js') {
      const name = pathname === '/approved-pricing.js' ? 'AOCPricing' : 'AOCBank';
      const data = name === 'AOCPricing' ? local.pricing : local.bank;
      response.writeHead(200, { ...headers, 'content-type': 'text/javascript;charset=utf-8' });
      return response.end(`globalThis.${name}=${JSON.stringify(data)};`);
    }
    if (pathname === '/__local-test-pricing.css') {
      response.writeHead(200, { ...headers, 'content-type': 'text/css;charset=utf-8' });
      return response.end('.test-pricing-banner{background:#fff4d6;color:#523600;border-bottom:2px solid #b47700;padding:16px 24px;font:14px/1.5 sans-serif;overflow-wrap:anywhere}.test-pricing-banner p{margin:6px 0}.test-pricing-banner summary{cursor:pointer;font-weight:600}');
    }
    const file = path.resolve(clientRoot, pathname === '/' ? 'index.html' : `.${pathname}`);
    const relative = path.relative(clientRoot, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return json(response, 403, { error: 'Invalid path.' });
    try {
      let body = fs.readFileSync(file);
      if (relative === 'index.html') body = Buffer.from(body.toString('utf8').replace('</head>', '<link rel="stylesheet" href="/__local-test-pricing.css"></head>').replace('<body>', `<body>${banner()}`));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
      response.writeHead(200, { ...headers, 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { json(response, 404, { error: 'Not found.' }); }
  });
  return server;
}

if (require.main === module) {
  const server = createPreviewServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4175, '127.0.0.1', () => {
    console.log(`Local-only synthetic pricing preview: http://127.0.0.1:4175`);
    console.log(fixture.label);
    console.log('No production files are changed. No AI credits are used. Ctrl+C stops the preview.');
  });
}
module.exports = { createTestPricing, createPreviewServer };
