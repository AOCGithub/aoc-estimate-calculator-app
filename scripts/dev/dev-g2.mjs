import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

for (const file of ['.env.local','.env.development.local','.env.stripe.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
// Sandbox credentials must win over any live settings provided by the env runner.
if (existsSync('.env.stripe.local')) Object.assign(process.env,parseEnv(readFileSync('.env.stripe.local','utf8')));
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('G2 requires the sandbox secret key in .env.stripe.local.');
const sendSandboxEmail=process.env.AOC_G2_LOCAL_EMAIL_MODE==='send';
if(sendSandboxEmail){
  const provider=process.env.AOC_G2_EMAIL_PROVIDER;
  const required=provider==='microsoft365'
    ? ['AOC_G2_EMAIL_FROM','AOC_G2_MS_TENANT_ID','AOC_G2_MS_CLIENT_ID','AOC_G2_MS_MAILBOX_ID','AOC_G2_MS_CLIENT_SECRET']
    : provider==='smtp'
      ? ['AOC_G2_EMAIL_FROM','AOC_G2_SMTP_HOST','AOC_G2_SMTP_USER','AOC_G2_SMTP_PASSWORD']
      : ['AOC_G2_EMAIL_PROVIDER'];
  const missing=required.filter(key=>!process.env[key]);
  if(missing.length)throw new Error(`Local email sending is not ready. Add ${missing.join(', ')} to an ignored local environment file.`);
}
const databaseConfigured=Boolean(process.env.SUPABASE_URL&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY));
const secretFile = new URL('../../artifacts/g2/session-secret',import.meta.url);
if (!process.env.AOC_ACCESS_SESSION_SECRET) {
  mkdirSync(new URL('../../artifacts/g2/',import.meta.url),{recursive:true});
  if (!existsSync(secretFile)) writeFileSync(secretFile,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
  process.env.AOC_ACCESS_SESSION_SECRET=readFileSync(secretFile,'utf8');
}
Object.assign(process.env,{
  VERCEL:'',AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',AOC_ACCESS_GATE_ENABLED:'true',VITE_AOC_ACCESS_GATE_ENABLED:'true',
  AOC_INTAKE_ONLY_ENABLED:'true',AOC_MANUAL_ACCESS_ENABLED:'false',AOC_RECAPTCHA_ENABLED:'false',
  AOC_ACCESS_REQUESTS_ENABLED:String(databaseConfigured),AOC_ESTIMATE_RECORDS_ENABLED:String(databaseConfigured),
  AOC_CLIENT_PROFILES_ENABLED:'true',AOC_LOCAL_CLIENT_PROFILES_ENABLED:String(!databaseConfigured),
  AOC_AI_ORGANIZER_ENABLED:'true',AOC_VOICE_ENABLED:'true',AOC_DESCRIPTION_CORRECTION_ENABLED:'true',
  AOC_G2_STORE_PATH:fileURLToPath(new URL('../../artifacts/g2/stripe-handoff.sqlite',import.meta.url)),
  ...(sendSandboxEmail
    ? {AOC_G2_PAYMENT_EMAILS_ENABLED:'true',AOC_G2_EMAIL_TEST_CLIENT_TO:''}
    : {AOC_G2_PAYMENT_EMAILS_ENABLED:'true',AOC_G2_EMAIL_PROVIDER:'capture',
      AOC_G2_EMAIL_FROM:'sandbox@localhost.test',AOC_G2_EMAIL_TEST_CLIENT_TO:'tester@localhost.test'}),
});
const port=process.env.AOC_G2_PORT || '5173';
console.log(sendSandboxEmail
  ? 'Local Stripe sandbox emails are enabled: the Stripe checkout address receives the client copy and AOC support receives the internal copy.'
  : 'Local payment emails are enabled in capture mode. Open the .eml and PDF files in artifacts/g2/email-capture; nothing is sent to a real inbox.');
console.log(`G2 local rehearsal: http://localhost:${port}/ — Stripe sandbox records stay local. ${databaseConfigured?'Opted-in details, profiles and estimates use the configured Supabase database.':'Supabase saving is unavailable; profile rehearsal is local only.'}`);
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'],{stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code || 0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
