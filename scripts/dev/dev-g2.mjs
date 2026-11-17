import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const file of ['.env.local','.env.development.local','.env.stripe.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const secretFile = new URL('../../artifacts/g2/session-secret',import.meta.url);
if (!process.env.AOC_ACCESS_SESSION_SECRET) {
  mkdirSync(new URL('../../artifacts/g2/',import.meta.url),{recursive:true});
  if (!existsSync(secretFile)) writeFileSync(secretFile,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
  process.env.AOC_ACCESS_SESSION_SECRET=readFileSync(secretFile,'utf8');
}
Object.assign(process.env,{
  VERCEL:'',AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',AOC_ACCESS_GATE_ENABLED:'true',VITE_AOC_ACCESS_GATE_ENABLED:'true',
  AOC_INTAKE_ONLY_ENABLED:'true',AOC_MANUAL_ACCESS_ENABLED:'false',AOC_RECAPTCHA_ENABLED:'false',
  AOC_ACCESS_REQUESTS_ENABLED:'false',AOC_ESTIMATE_RECORDS_ENABLED:'false',
  AOC_CLIENT_PROFILES_ENABLED:'true',AOC_LOCAL_CLIENT_PROFILES_ENABLED:'true',
  AOC_G2_STORE_PATH:fileURLToPath(new URL('../../artifacts/g2/stripe-handoff.sqlite',import.meta.url)),
});
const port=process.env.AOC_G2_PORT || '5173';
console.log(`G2 local rehearsal: http://localhost:${port}/ — local records, Stripe test keys only. Live Supabase recording is off.`);
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'],{stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code || 0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
