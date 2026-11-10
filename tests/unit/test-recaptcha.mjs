import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import Recaptcha from '../../server/access/recaptcha.cjs';
import { handleAccessVerification, handleAccessStatus } from '../../server/api-handlers.mjs';
import { createLocalClientProfiles } from '../../server/profiles/local-client-profiles.mjs';

const origin='http://127.0.0.1:48537';
const profile={name:'Synthetic CAPTCHA Test',company:'Synthetic Company',website:'example.com',role:'Tester',businessEmail:'captcha@example.com'};
const env={AOC_ACCESS_GATE_ENABLED:'true',AOC_INTAKE_ONLY_ENABLED:'true',AOC_ACCESS_REQUESTS_ENABLED:'true',AOC_ESTIMATE_RECORDS_ENABLED:'true',
  AOC_ACCESS_SESSION_SECRET:'synthetic-session-secret-at-least-32-characters',SUPABASE_URL:'https://captcha-store.example.invalid',SUPABASE_SECRET_KEY:'sb_secret_synthetic_fixture',
  VITE_RECAPTCHA_SITE_KEY:'synthetic-public-site-key',RECAPTCHA_SECRET_KEY:'synthetic-private-server-key'};
const request=(body={},cookie='')=>new Request(origin+'/api/access/verify',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({...profile,...body})});
const good=(version='v3')=>({success:true,...(version==='v3'?{score:0.9,action:'calculator_entry'}:{}),hostname:new URL(origin).hostname,challenge_ts:new Date().toISOString()});
let answer=good(), providerStatus=200, providerCalls=0, writes=0, fail=false;
const originalFetch=globalThis.fetch;
async function provider(url, options) {
  if(String(url)==='https://www.google.com/recaptcha/api/siteverify') {
    providerCalls++;if(fail)throw Error('private-provider-diagnostics');
    assert.equal(options.method,'POST');
    const body=new URLSearchParams(options.body);
    assert.deepEqual([...body.keys()].sort(),['response','secret']);
    assert.equal(body.get('secret'),env.RECAPTCHA_SECRET_KEY);
    return answer==='invalid-json'?new Response('not json'):Response.json(answer,{status:providerStatus});
  }
  assert.ok(String(url).startsWith(env.SUPABASE_URL+'/rest/v1/'));
  writes++;assert.ok(!JSON.stringify(options).includes('captchaToken'),'verification payload is not saved');
  assert.ok(!JSON.stringify(options).includes(env.RECAPTCHA_SECRET_KEY));
  return Response.json([],{status:201});
}
globalThis.fetch=provider;
try {
  assert.equal(Recaptcha.configuration({}).enabled,false);
  assert.equal(Recaptcha.configuration({...env,AOC_RECAPTCHA_ENABLED:'false'}).enabled,false);
  assert.equal(Recaptcha.configuration({RECAPTCHA_SECRET_KEY:'one-key'}).configured,false);
  assert.equal(Recaptcha.configuration({...env,RECAPTCHA_MIN_SCORE:'invalid'}).configured,false);
  assert.equal(Recaptcha.configuration({...env,RECAPTCHA_VERSION:'unknown'}).configured,false);
  assert.equal(Recaptcha.configuration({...env,RECAPTCHA_VERSION:'v2',RECAPTCHA_MIN_SCORE:'unused'}).configured,true);
  const status=await handleAccessStatus(new Request(origin+'/api/access/status'),env).json();
  assert.equal(status.recaptcha.siteKey,env.VITE_RECAPTCHA_SITE_KEY);
  assert.equal(status.recaptcha.action,'calculator_entry');
  assert.equal(status.recaptcha.version,'v3');
  assert.ok(!JSON.stringify(status).includes(env.RECAPTCHA_SECRET_KEY));
  for(const token of [undefined,'',[],{},'x'.repeat(8193)]) {
    const before=providerCalls;
    assert.equal((await Recaptcha.verify(request(),env,token)).status,403);
    assert.equal(providerCalls,before);
  }
  assert.equal((await Recaptcha.verify(request(),{...env,RECAPTCHA_SECRET_KEY:''},'token')).status,503);
  for(const change of [
    {success:false},{score:0.49},{score:'0.9'},{score:2},{score:null},{action:'other_action'},
    {hostname:'other.example.com'},{challenge_ts:'invalid'},{challenge_ts:new Date(Date.now()-180000).toISOString()},
    {challenge_ts:new Date(Date.now()+60000).toISOString()},{'error-codes':['timeout-or-duplicate']},
    {score:0.9,'error-codes':['Over free quota.']},
  ]) {
    answer={...good(),...change};assert.equal((await Recaptcha.verify(request(),env,'token')).status,403);
  }
  answer=good();answer.score=0.5;assert.equal(await Recaptcha.verify(request(),env,'token'),null);
  const checkboxEnv={...env,RECAPTCHA_VERSION:'v2'};
  assert.equal((await handleAccessStatus(new Request(origin+'/api/access/status'),checkboxEnv).json()).recaptcha.version,'v2');
  answer=good('v2');assert.equal(await Recaptcha.verify(request(),checkboxEnv,'solved-checkbox'),null,'v2 does not require a v3 score or action');
  answer.challenge_ts=new Date(Date.now()-600000).toISOString();
  assert.equal(await Recaptcha.verify(request(),checkboxEnv,'newly-solved-checkbox'),null,'v2 challenge load time can precede the fresh solve; Google enforces token expiry');
  for(const change of [{success:false},{hostname:'other.example.com'},{challenge_ts:'invalid'},{challenge_ts:new Date(Date.now()+60000).toISOString()},{'error-codes':['timeout-or-duplicate']},{'error-codes':['Over free quota.']},{score:0.9},{action:'calculator_entry'}]){
    answer={...good('v2'),...change};assert.equal((await Recaptcha.verify(request(),checkboxEnv,'checkbox-token')).status,403);
  }
  answer=good('v2');assert.equal((await Recaptcha.verify(request(),env,'wrong-key-type')).status,403,'v2 tokens cannot satisfy v3 checks');
  providerStatus=500;assert.equal((await Recaptcha.verify(request(),env,'token')).status,503);providerStatus=200;
  answer='invalid-json';assert.equal((await Recaptcha.verify(request(),env,'token')).status,503);
  fail=true;const safeError=await Recaptcha.verify(request(),env,'token');assert.equal(safeError.status,503);assert.ok(!(await safeError.text()).includes('private-provider'));fail=false;

  const workerSource=await readFile(new URL('../../dist/server/index.js',import.meta.url),'utf8');
  const context=vm.createContext({Request,Response,URL,URLSearchParams,Blob,FormData,AbortSignal,crypto:webcrypto,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,console,fetch:provider});
  vm.runInContext(workerSource.replace(/export default\s*\{\s*async fetch/,'globalThis.worker={async fetch'),context);
  for(const version of ['v3','v2'])for(const [name,dispatch]of [['Node',(req,settings)=>handleAccessVerification(req,settings)],['Worker',(req,settings)=>context.worker.fetch(req,settings)]]) {
    const settings={...env,RECAPTCHA_VERSION:version};
    for(const saveData of [false,true]) {
      const before=writes;answer={...good(version),success:false};
      let response=await dispatch(request({saveData}),settings);assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null);
      response=await dispatch(request({saveData,captchaToken:'rejected-token'}),settings);assert.equal(response.status,403);assert.equal(writes,before,name+' rejected requests cannot write records');
      answer=good(version);response=await dispatch(request({saveData,captchaToken:'fresh-token'}),settings);assert.equal(response.status,200);
      assert.ok(response.headers.get('set-cookie'));assert.equal((await response.json()).saveData,saveData);
      assert.equal(writes,before+Number(saveData));
      answer={...good(version),success:false,'error-codes':['timeout-or-duplicate']};
      response=await dispatch(request({saveData,captchaToken:'fresh-token'}),settings);assert.equal(response.status,403,'A reused provider token is rejected');
    }
    const before=writes;
    answer=good(version);const manual={...settings,AOC_INTAKE_ONLY_ENABLED:'false',AOC_MANUAL_ACCESS_ENABLED:'true'};
    assert.equal((await dispatch(request(),manual)).status,403);
    const pending=await dispatch(request({captchaToken:'manual-fresh'}),manual);
    assert.equal(pending.status,202);assert.equal(writes,before+1,'Manual review requires CAPTCHA too');
  }

  // Profile writes use the entry session; deleting an owned profile still works after logout.
  const profiles=createLocalClientProfiles(':memory:',{environment:env});
  const body={profile,consent:true,confirmed:true};
  const post=cookie=>new Request(origin+'/api/client-profile',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await profiles.handle(post(''))).status,401,'Profile creation cannot bypass the entry check');
    answer=good();const access=await handleAccessVerification(request({saveData:false,captchaToken:'profile-entry'}),env);
    const session=access.headers.get('set-cookie').split(';')[0];
    const saved=await profiles.handle(post(session));assert.equal(saved.status,200);
    const profileCookie=saved.headers.get('set-cookie').split(';')[0],revision=(await saved.json()).revision;
    assert.equal((await profiles.handle(new Request(origin+'/api/client-profile',{method:'DELETE',headers:{origin,cookie:profileCookie,'if-match':revision}}))).status,200);
  }finally{profiles.close();}
  console.log('PASS: reCAPTCHA v2/v3 verification, version mismatch, score/action/hostname/age, replay and quota errors, missing configuration, provider failures, no writes/sessions before verification, Node/Worker/manual parity, private credentials and profile bypass protection. No Google calls.');
}finally{globalThis.fetch=originalFetch;}
