// Launch through Vercel's env runner to keep database secrets out of local files.
import { spawn } from 'node:child_process';

process.env.AOC_ACCESS_GATE_ENABLED = 'true';
process.env.VITE_AOC_ACCESS_GATE_ENABLED = 'true';
process.env.AOC_ACCESS_REQUESTS_ENABLED = 'true';
process.env.AOC_MANUAL_ACCESS_ENABLED = process.argv.includes('--review') ? 'true' : 'false';
process.env.AOC_INTAKE_ONLY_ENABLED = process.argv.includes('--review') || process.argv.includes('--previous') ? 'false' : 'true';
process.env.AOC_ESTIMATE_RECORDS_ENABLED = process.env.AOC_INTAKE_ONLY_ENABLED;
// Session secret and local tester approvals are read from .env.development.local.
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', process.env.AOC_LOCAL_ACCESS_PORT || '5173', '--strictPort'], {
  stdio: 'inherit', env: process.env,
});
child.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
