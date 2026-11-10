import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Use --database through Vercel env run to test the real Supabase profile store.
const database = process.argv.includes('--database');
Object.assign(process.env, {
  VERCEL: '',
  VITE_AOC_ACCESS_GATE_ENABLED: 'true', AOC_ACCESS_GATE_ENABLED: 'true',
  AOC_INTAKE_ONLY_ENABLED: 'true', AOC_MANUAL_ACCESS_ENABLED: 'false',
  AOC_ACCESS_REQUESTS_ENABLED: database ? 'true' : 'false', AOC_ESTIMATE_RECORDS_ENABLED: database ? 'true' : 'false',
  AOC_ACCESS_SESSION_SECRET: randomBytes(32).toString('hex'),
  AOC_CLIENT_PROFILES_ENABLED: 'true', AOC_LOCAL_CLIENT_PROFILES_ENABLED: database ? 'false' : 'true',
});
const port = process.env.AOC_LOCAL_PROFILE_PORT || (database ? '5180' : '5174');
console.log(`Profile preview: http://127.0.0.1:${port}/ - ${database ? 'Supabase-backed; saving requires consent' : 'offline local database'}.`);
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  stdio: 'inherit', env: process.env,
});
child.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
