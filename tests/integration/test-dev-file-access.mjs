// Exercise private-file protection with a synthetic file in an isolated Vite root.
// Never probe the project's real environment files or credentials.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import projectConfiguration from '../../vite.config.mjs';

const temporaryBase = path.resolve(tmpdir());
const root = await mkdtemp(path.join(temporaryBase, 'aoc-vite-security-'));
const marker = 'synthetic-file-access-' + randomUUID();
let server;
try {
  await writeFile(path.join(root, 'index.html'), '<!doctype html><p>Synthetic security fixture</p>');
  await writeFile(path.join(root, '.env.security-fixture'), 'SYNTHETIC_MARKER=' + marker);
  await mkdir(path.join(root, 'artifacts', 'g2'), {recursive:true});
  await writeFile(path.join(root, 'artifacts', 'g2', 'synthetic.sqlite'), marker);
  await writeFile(path.join(root, 'artifacts', 'g2', 'session-secret'), marker);
  const deny = projectConfiguration({mode:'test',command:'serve'}).server.fs.deny;
  server = await createServer({
    configFile: false, root, envDir: root, cacheDir: path.join(root, '.vite'), logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { strict: true, allow: [root], deny } },
  });
  await server.listen();
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  assert.equal((await fetch(origin, { signal: AbortSignal.timeout(8000) })).status, 200);
  for (const privatePath of ['/.env.security-fixture','/artifacts/g2/synthetic.sqlite','/artifacts/g2/session-secret']) for (const query of ['', '?raw', '?import&raw', '?import&url&inline']) {
    const response = await fetch(origin + privatePath + query, { signal: AbortSignal.timeout(8000) });
    const body = await response.text();
    assert.ok([403, 404].includes(response.status), 'Private-file request must be blocked: ' + query + ' returned HTTP ' + response.status);
    assert.equal(body.includes(marker), false, 'Synthetic private-file contents cannot be returned');
  }
  console.log('PASS: Vite blocks environment files, G2 database files and private local secrets through direct, raw/import and inline URL requests. Only synthetic local fixture files were used.');
} finally {
  await server?.close();
  const resolved = path.resolve(root);
  assert.equal(path.dirname(resolved), temporaryBase, 'Cleanup stays inside the intended temporary directory');
  assert.ok(path.basename(resolved).startsWith('aoc-vite-security-'));
  await rm(resolved, { recursive: true, force: true });
}
