const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const clientPath = path.join(root, 'dist', 'client');
const distPath = path.join(root, 'dist');

if (!fs.existsSync(path.join(clientPath, 'index.html'))) {
  throw Error('Build the React client before packaging the Worker.');
}

const assets = {};

function contentType(filename) {
  if (filename.endsWith('.html')) return 'text/html;charset=utf-8';
  if (filename.endsWith('.css')) return 'text/css;charset=utf-8';
  if (filename.endsWith('.js')) return 'text/javascript;charset=utf-8';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.json')) return 'application/json;charset=utf-8';
  return 'application/octet-stream';
}

function collectAssets(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectAssets(absolute);
      continue;
    }

    const relative = '/' + path.relative(clientPath, absolute).replaceAll('\\', '/');
    if (!/\.(html|css|js)$/i.test(entry.name)) continue;
    assets[relative] = {
      type: contentType(entry.name),
      body: fs.readFileSync(absolute, 'utf8'),
    };
  }
}

collectAssets(clientPath);

const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const catalogData = require(path.join(root, 'public/catalog.js'));
const questionChoices = {};
for (const question of catalogData.questions) {
  (questionChoices[question.profile] ??= []).push(question.answer);
}
const snapshot = require(path.join(root, 'data/v8-rules-snapshot.json'));
const marketingChoices = {
  ...snapshot.choices,
  seoCapabilities: ['Research / planning', 'Existing-page optimization', 'New search content', 'Technical SEO monitoring', 'Internal linking / site structure', 'Structured data', 'GEO content readiness', 'AI-search visibility checks', 'Monitoring / reporting'],
};
const worker = 'const ASSETS=' + JSON.stringify(assets) + ';\n'
  + 'const CATALOG=' + JSON.stringify(catalogData.catalog) + ';\n'
  + 'const QUESTION_CHOICES=' + JSON.stringify(questionChoices) + ';\n'
  + 'const MARKETING_CHOICES=' + JSON.stringify(marketingChoices) + ';\n'
  + source('public/intake-contract.js') + '\n'
  + source('public/engine.js') + '\n'
  + source('public/approved-bank.js') + '\n'
  + source('public/approved-pricing.js') + '\n'
  + source('public/journey-engine.js') + '\n'
  + source('public/journey-contract.js') + '\n'
  + source('public/journey-calculation.js') + '\n'
  + source('worker/journey-api.js') + '\n'
  + source('worker/intake-api.js') + '\n'
  + source('worker/index.js');

fs.mkdirSync(path.join(distPath, 'server'), { recursive: true });
fs.mkdirSync(path.join(distPath, '.openai'), { recursive: true });
fs.writeFileSync(path.join(distPath, 'server/index.js'), worker);
fs.copyFileSync(path.join(root, '.openai/hosting.json'), path.join(distPath, '.openai/hosting.json'));
console.log('Packaged the React estimator and retained API routes.');
