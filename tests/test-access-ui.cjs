const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const browserCandidates = process.platform === 'win32'
  ? [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  : [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = browserCandidates.find(candidate => candidate && fs.existsSync(candidate));

if (!executablePath) {
  console.log('SKIP: Phase 2 gate browser test (set CHROME_PATH to an installed Chromium browser).');
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, '..');
const clientRoot = path.join(projectRoot, 'dist', 'client');

const mime = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.png': 'image/png',
};

function json(response, status, data, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  response.end(JSON.stringify(data));
}

let requestsEnabled = false;
let intakeOnly = false;
let storageFailure = false;
let submissions = 0;
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const authenticated = String(request.headers.cookie || '').includes('aoc_gate_test=approved');
  if (pathname === '/api/access/status') {
    json(response, 200, { enabled: true, configured: true, authenticated, requestsEnabled, intakeOnly,
      recordsEnabled: intakeOnly, savingAvailable: intakeOnly, saveData: String(request.headers.cookie || '').includes('aoc_saving_test=true') });
    return;
  }
  if (pathname === '/api/access/verify') {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      const body = JSON.parse(raw);
      submissions += 1;
      assert.deepEqual(Object.keys(body).sort(), ['businessEmail', 'company', 'name', ...(intakeOnly ? ['saveData'] : []), 'role', 'website'].sort());
      const valid = body.businessEmail === 'approved@example.com';
      if (requestsEnabled && storageFailure && (!intakeOnly || body.saveData)) {
        json(response, 503, { error: 'We could not save your access request. Your details are still here; please try again later.' });
        return;
      }
      if (requestsEnabled && !valid && !intakeOnly) {
        json(response, 202, { enabled: true, authenticated: false, pending: true });
        return;
      }
      if (!valid && !intakeOnly) {
        json(response, 403, { error: 'This business email is not approved for calculator access.' });
        return;
      }
      json(response, 200, { enabled: true, authenticated: true, saveData: body.saveData === true }, {
        'set-cookie': ['aoc_gate_test=approved; Path=/; HttpOnly; SameSite=Lax', 'aoc_saving_test=' + (body.saveData === true) + '; Path=/; HttpOnly; SameSite=Lax'],
      });
    });
    return;
  }
  if (pathname === '/api/access/logout') {
    json(response, 200, { authenticated: false }, {
      'set-cookie': 'aoc_gate_test=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(clientRoot, relative);
  if (!file.startsWith(clientRoot + path.sep) && file !== path.join(clientRoot, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const contentType = mime[path.extname(file)] || 'application/octet-stream';
    let body = fs.readFileSync(file);
    if (relative === 'index.html') {
      body = Buffer.from(body.toString('utf8').replace('</head>', '<meta name="aoc-access-gate" content="enabled" /></head>'));
    }
    response.writeHead(200, { 'content-type': contentType });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const expectedRejection = message.type() === 'error'
      && message.location().url.endsWith('/api/access/verify')
      && message.text().includes('Failed to load resource');
    if (message.type() === 'error' && !expectedRejection && !message.text().includes('fonts.googleapis.com')) {
      errors.push(message.text());
    }
  });

  try {
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Continue to the AI Commerce estimator' }).waitFor();
    for (const label of ['Your name', 'Company', 'Company website', 'Your role', 'Business email']) {
      assert.equal(await page.getByLabel(label, { exact: true }).count(), 1, label + ' is present');
    }
    assert.equal(await page.locator('input').count(), 5, 'the gate contains only the five requested fields');
    assert.equal(await page.getByText(/LinkedIn access/).count(), 1, 'privacy copy explicitly rules out LinkedIn access');
    assert.equal(await page.getByText(/email-inbox access/).count(), 1, 'privacy copy explicitly rules out inbox access');
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0, 'Phase 8 does not add profile-saving consent');

    await page.getByLabel('Your name').fill('Browser Test');
    await page.getByLabel('Company', { exact: true }).fill('Example Company');
    await page.getByLabel('Company website').fill('example.com');
    await page.getByLabel('Your role').fill('Operations lead');
    await page.getByLabel('Business email').fill('unapproved@example.com');
    await page.getByRole('button', { name: 'Continue to estimator' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(), /not approved/);

    await page.getByLabel('Business email').fill('approved@example.com');
    await page.getByRole('button', { name: 'Continue to estimator' }).click();
    await page.locator('.area').first().waitFor();
    assert.equal(await page.locator('.area').count(), 12);
    assert.deepEqual(await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })), { local: [], session: [] }, 'Phase 8 does not save a reusable browser profile');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'gate and calculator fit mobile width');

    await page.getByRole('button', { name: 'End session' }).click();
    await page.getByRole('heading', { name: 'Continue to the AI Commerce estimator' }).waitFor();
    assert.equal(await page.getByLabel('Business email').inputValue(), '', 'gate details are not reused after logout');
    assert.equal(await page.getByLabel('Your name').inputValue(), '');
    requestsEnabled = true;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Request access / continue' }).waitFor();
      assert.equal(await page.locator('input').count(), 5);
      assert.equal(await page.getByText(/saved privately for access review/).count(), 1, 'Saving the access details must be disclosed.');
      const before = submissions;
      await page.getByRole('button', { name: 'Request access / continue' }).click();
      assert.equal(submissions, before, 'Blank required fields must not submit.');
      await page.getByLabel('Your name').fill('Pending Browser Test');
      await page.getByLabel('Company', { exact: true }).fill('Example Company');
      await page.getByLabel('Company website').fill('example.com');
      await page.getByLabel('Your role').fill('Operations lead');
      await page.getByLabel('Business email').fill('pending@example.com');
      storageFailure = true;
      await page.getByRole('button', { name: 'Request access / continue' }).click();
      await page.getByRole('alert').waitFor();
      assert.match(await page.getByRole('alert').textContent(), /could not save/);
      assert.equal(await page.getByLabel('Business email').inputValue(), 'pending@example.com');
      assert.equal(await page.getByLabel('Your name').inputValue(), 'Pending Browser Test');
      assert.equal(await page.getByRole('heading', { name: 'Request received' }).count(), 0);
      storageFailure = false;
      await page.getByRole('button', { name: 'Request access / continue' }).click();
      await page.getByRole('status').waitFor();
      assert.match(await page.getByRole('status').textContent(), /not yet approved/);
      assert.equal(await page.locator('.area').count(), 0, 'Pending requests do not open the calculator.');
      assert.equal(await page.getByRole('button', { name: 'Request access / continue' }).count(), 0, 'Confirmation prevents accidental duplicate submission.');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', { name: 'Back to form' }).click();
      assert.equal(await page.getByLabel('Your name').inputValue(), 'Pending Browser Test');
      await page.getByLabel('Business email').fill('approved@example.com');
      await page.getByRole('button', { name: 'Request access / continue' }).click();
      await page.locator('.area').first().waitFor();
      assert.equal(await page.locator('.area').count(), 12);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.area').first().waitFor();
      await page.getByRole('button', { name: 'End session' }).click();
      await page.getByLabel('Your name').waitFor();
      assert.equal(await page.getByLabel('Your name').inputValue(), '');
      assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
    }
    intakeOnly = true;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Continue to calculator' }).waitFor();
      assert.equal(await page.locator('.access-header-badge').count(), 0, 'Entry header has no preview badge.');
      assert.equal(await page.evaluate(() => {
        const pageElement = document.querySelector('.access-page');
        pageElement.scrollLeft = 190;
        return pageElement.scrollLeft;
      }), 0, 'Decorative overflow cannot shift the form sideways.');
      assert.equal(await page.locator('input:not([type="checkbox"])').count(), 5);
      const consent = page.getByRole('checkbox', { name: /Save my details and estimates/ });
      assert.equal(await consent.isChecked(), false);
      assert.equal(await page.getByText(/Verification and approval are on hold/).count(), 1);
      await page.getByLabel('Your name').fill('Intake Browser Test');
      await page.getByLabel('Company', { exact: true }).fill('Example Company');
      await page.getByLabel('Company website').fill('example.com');
      await page.getByLabel('Your role').fill('Testing');
      await page.getByLabel('Business email').fill('not-approved@example.com');
      await consent.check();
      storageFailure = true;
      await page.getByRole('button', { name: 'Continue to calculator' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('Your name').inputValue(), 'Intake Browser Test');
      assert.equal(await page.locator('.area').count(), 0);
      await consent.uncheck();
      await page.getByRole('button', { name: 'Continue to calculator' }).click();
      await page.locator('.area').first().waitFor();
      await page.getByRole('note').filter({ hasText: 'Data saving is off.' }).waitFor();
      assert.equal(await page.locator('.area').count(), 12);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.area').first().waitFor();
      await page.getByRole('note').filter({ hasText: 'Data saving is off.' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', { name: 'End session' }).click();
      await page.getByLabel('Your name').waitFor();
      assert.equal(await page.getByLabel('Your name').inputValue(), '');
      assert.equal(await consent.isChecked(), false);
      await page.getByLabel('Your name').fill('Saved Browser Test');
      await page.getByLabel('Company', { exact: true }).fill('Example Company');
      await page.getByLabel('Company website').fill('example.com');
      await page.getByLabel('Your role').fill('Testing');
      await page.getByLabel('Business email').fill('save@example.com');
      await consent.check();
      storageFailure = false;
      await page.getByRole('button', { name: 'Continue to calculator' }).click();
      await page.locator('.area').first().waitFor();
      await page.getByRole('note').filter({ hasText: 'Data saving is on.' }).waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('note').filter({ hasText: 'Data saving is on.' }).waitFor();
      await page.getByRole('button', { name: 'End session' }).click();
      await consent.waitFor();
      assert.equal(await consent.isChecked(), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Gate compatibility, pending requests, save-and-continue mode, failure recovery, private-storage disclosure, approved access, logout, and desktop/mobile layout.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  server.close(() => process.exit(1));
});
