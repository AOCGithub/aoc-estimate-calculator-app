// Local Stripe sandbox only. Keys stay in the child environment and Git-ignored env file.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const filename='.env.stripe.local';
const key=parseEnv(readFileSync(filename,'utf8')).STRIPE_SECRET_KEY;
if(!key?.startsWith('sk_test_'))throw new Error('Add a Stripe sandbox secret key to .env.stripe.local first.');
const installed=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'Programs','StripeCLI','stripe.exe'):null;
const executable=installed&&existsSync(installed)?installed:'stripe';
const port=process.env.AOC_G2_PORT||'5173';
if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('Use a valid local G2 port.');
const child=spawn(executable,['listen','--skip-update','--events-from','@self','--events',
  'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,payment_intent.payment_failed',
  '--forward-to',`http://localhost:${port}/api/payments/webhook`],{
  env:{...process.env,STRIPE_API_KEY:key},stdio:['ignore','pipe','pipe'],
});
console.log(`Connecting Stripe sandbox events to localhost:${port}. No live billing.`);
let saved=false;
function output(line){
  const secret=line.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if(secret){
    const content=readFileSync(filename,'utf8');
    const pattern=/^\s*(?:export\s+)?STRIPE_WEBHOOK_SECRET\s*=.*$/m;
    writeFileSync(filename,pattern.test(content)?content.replace(pattern,'STRIPE_WEBHOOK_SECRET='+secret):content+'\nSTRIPE_WEBHOOK_SECRET='+secret+'\n');
    saved=true;
    console.log('Stripe sandbox listener connected. Signing secret saved privately; restart the G2 preview if it was already running.');
  }else if(/evt_/.test(line)){
    const event=line.match(/(?:checkout\.session|payment_intent)\.[a-z_]+/)?.[0]||'Stripe event';
    const status=line.match(/\[(\d{3})\]/)?.[1];
    console.log(`${event}${status?' — local response '+status:' received'}`);
  }else if(/error|failed|unauthorized/i.test(line)){
    console.error('Stripe listener reported a connection or delivery error. Check CLI access and the local preview.');
  }
}
for(const stream of [child.stdout,child.stderr]){
  let pending='';
  stream.setEncoding('utf8');
  stream.on('data',chunk=>{pending+=chunk;const lines=pending.split(/[\r\n]+/);pending=lines.pop();for(const line of lines)output(line);});
  stream.on('end',()=>{if(pending)output(pending);});
}
child.on('error',()=>{console.error('Stripe CLI could not start. Install it and try again.');process.exitCode=1;});
child.on('exit',code=>{if(!saved)console.error('Stripe listener stopped before the signing secret was received.');process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
