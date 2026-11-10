// Production-built React + actual Node handlers + Supabase. No deployment/paid AI.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { localApi } from '../../server/local-api.mjs';
assert.ok(process.argv.includes('--database'), 'Explicit --database required.');
const root=fileURLToPath(new URL('../../dist/client/',import.meta.url));
const environment={...process.env,AOC_RECAPTCHA_ENABLED:'false',AOC_CLIENT_PROFILES_ENABLED:'true',AOC_LOCAL_CLIENT_PROFILES_ENABLED:'false',
  AOC_ACCESS_GATE_ENABLED:'true',AOC_INTAKE_ONLY_ENABLED:'true',AOC_MANUAL_ACCESS_ENABLED:'false',AOC_ACCESS_REQUESTS_ENABLED:'true',AOC_ESTIMATE_RECORDS_ENABLED:'true',
  AOC_ACCESS_SESSION_SECRET:randomBytes(32).toString('hex'),AOC_AI_ORGANIZER_ENABLED:'false',AOC_VOICE_ENABLED:'false',AOC_DESCRIPTION_CORRECTION_ENABLED:'false'};
let middleware;
const server=http.createServer((request,response)=>middleware(request,response,async()=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(pathname.startsWith('/@fs/')){response.writeHead(403).end();return;}
  const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){response.writeHead(403).end();return;}
  try{
    let contents=await readFile(file);
    if(relative==='index.html')contents=Buffer.from(contents.toString().replace('<head>','<head><meta name="aoc-access-gate" content="enabled">'));
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
    response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(contents);
  }catch{response.writeHead(404).end();}
}));
localApi(environment).configureServer({httpServer:server,middlewares:{use(handler){middleware=handler;}}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
  for(const [filename,args] of [['tests/browser/test-client-profiles-ui.cjs',[]],['tests/browser/test-company-profile-ui.cjs',[]],['tests/database/test-gate-saving-choices.mjs',['--database']]]){
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[filename,...args],{stdio:'inherit',env:{...process.env,AOC_PROFILE_TEST_URL:origin,AOC_GATE_TEST_URL:origin,AOC_PROFILE_STORAGE_KIND:'supabase'}});
      child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(filename+' failed ('+code+')')));
    });
  }
  console.log('PASS: Production React build and real Supabase profile/estimate-consent browser journeys.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
