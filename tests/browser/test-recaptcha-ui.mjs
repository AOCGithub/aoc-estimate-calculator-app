// Production-built React and real local handlers, with synthetic Google/Supabase providers.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { localApi } from '../../server/local-api.mjs';
const require=createRequire(import.meta.url),fixture=require('../fixtures/commercial.cjs');
const root=path.resolve('dist/client');
const version=process.argv.includes('--v2')?'v2':'v3';
const csp=JSON.parse(await readFile('vercel.json','utf8')).headers.flatMap(rule=>rule.headers).find(header=>header.key==='Content-Security-Policy').value;
const env={AOC_ACCESS_GATE_ENABLED:'true',AOC_INTAKE_ONLY_ENABLED:'true',AOC_MANUAL_ACCESS_ENABLED:'false',AOC_ACCESS_REQUESTS_ENABLED:'true',AOC_ESTIMATE_RECORDS_ENABLED:'true',
  AOC_CLIENT_PROFILES_ENABLED:'true',AOC_LOCAL_CLIENT_PROFILES_ENABLED:'true',AOC_AI_ORGANIZER_ENABLED:'false',AOC_VOICE_ENABLED:'false',AOC_DESCRIPTION_CORRECTION_ENABLED:'false',
  AOC_ACCESS_SESSION_SECRET:'synthetic-browser-session-secret-at-least-32-characters',SUPABASE_URL:'https://captcha-browser.example.invalid',SUPABASE_SECRET_KEY:'sb_secret_synthetic_browser',
  RECAPTCHA_VERSION:version,VITE_RECAPTCHA_SITE_KEY:'synthetic-browser-site',RECAPTCHA_SECRET_KEY:'synthetic-private-key-not-in-browser'};
let middleware,origin,mode='ok',googleCalls=0,submissions=0,records=0;
const originalFetch=globalThis.fetch,used=new Set();
globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://www.google.com/recaptcha/api/siteverify'){
    googleCalls++;const payload=new URLSearchParams(options.body),token=payload.get('response');
    assert.equal(payload.get('secret'),env.RECAPTCHA_SECRET_KEY);
    if(mode==='failure')throw Error('synthetic-google-failure');
    if(used.has(token))return Response.json({success:false,'error-codes':['timeout-or-duplicate']});
    used.add(token);
    await new Promise(resolve=>setTimeout(resolve,100));
    return Response.json({success:version==='v3'||mode!=='low',...(version==='v3'?{score:mode==='low'?0.1:0.9,action:'calculator_entry'}:{}),hostname:new URL(origin).hostname,challenge_ts:new Date().toISOString()});
  }
  assert.ok(String(url).startsWith(env.SUPABASE_URL+'/rest/v1/'),'No external test traffic');
  assert.ok(!options.body.includes('captchaToken'),'Tokens must never reach persistence');
  if(String(url).endsWith('/access_requests'))submissions++;else if(String(url).endsWith('/estimates'))records++;else assert.fail('Unexpected database operation');
  return Response.json([],{status:201});
};
const server=http.createServer((request,response)=>middleware(request,response,async()=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(pathname.startsWith('/@fs/'))return response.writeHead(403).end();
  const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname);
  if(!file.startsWith(root+path.sep))return response.writeHead(403).end();
  try{
    let body=await readFile(file);
    if(file===path.join(root,'index.html'))body=Buffer.from(body.toString().replace('<head>','<head><meta name="aoc-access-gate" content="enabled">'));
    response.writeHead(200,{'content-type':{'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png'}[path.extname(file)]||'application/octet-stream','content-security-policy':csp}).end(body);
  }catch{response.writeHead(404).end();}
}));
localApi(env).configureServer({httpServer:server,middlewares:{use(handler){middleware=handler;}}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const values={'Your name':'Synthetic CAPTCHA Browser',Company:'Synthetic CAPTCHA Company','Company website':'example.com','Your role':'Tester','Business email':'captcha-browser@example.com'};
const sdk=`window.__captchaCalls=0;const callbacks=[];window.grecaptcha={ready:callback=>callbacks.push(callback)};setTimeout(()=>{window.grecaptcha={ready:callback=>callback(),execute:async(key,options)=>{window.__captchaCalls++;window.__captchaAction=options.action;if(window.__captchaHang)return new Promise(resolve=>{window.__lateCaptcha=resolve;});await new Promise(resolve=>setTimeout(resolve,80));return 'synthetic-'+Math.random()+'-'+Date.now();}};callbacks.forEach(callback=>callback());},window.__captchaInitDelay||60);`;
const checkboxSdk=`const onload=new URL(document.currentScript.src).searchParams.get('onload');const widgets=[];setTimeout(()=>{window.grecaptcha={render:(container,options)=>{const id=widgets.length;const box=document.createElement('div');box.style.cssText='box-sizing:border-box;border:1px solid #ccc;padding:16px;width:'+(options.size==='compact'?'164':'304')+'px;height:'+(options.size==='compact'?'144':'78')+'px';const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';label.append(input,document.createTextNode("I'm not a robot"));box.append(label);container.append(box);input.onchange=()=>{if(input.checked){options.callback('synthetic-v2-'+Math.random()+'-'+Date.now());}};widgets.push({input,options});window.__expireCaptcha=()=>options['expired-callback']();window.__errorCaptcha=()=>options['error-callback']();return id;},reset:id=>{widgets[id].input.checked=false;}};window[onload]();},window.__captchaInitDelay||60);`;
async function fill(page){for(const[label,value]of Object.entries(values))await page.getByLabel(label,{exact:true}).fill(value);}
async function solve(page){if(version==='v2')await page.getByRole('checkbox',{name:"I'm not a robot",exact:true}).check();}
try{
  for(const width of (version==='v2'?[1440,390,320]:[1440,390]))for(const[remember,record]of (width===320?[[false,false]]:[[false,false],[true,false],[false,true],[true,true]])){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
    page.setDefaultTimeout(15000);const errors=[];let scripts=0,blockScript=false;
    if(width===1440&&!remember&&!record)await page.addInitScript(()=>{window.__captchaInitDelay=2000;});
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('https://www.google.com/recaptcha/api.js?*',route=>{
      scripts++;return blockScript?route.abort():route.fulfill({contentType:'text/javascript',body:version==='v2'?checkboxSdk:sdk});
    });
    try{
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Continue to calculator',exact:true}).waitFor();
      assert.ok(await page.locator('.recaptcha-notice').isVisible());
      assert.equal(await page.locator('.recaptcha-notice a').count(),2);
      const beforeBlank=googleCalls;
      await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
      assert.equal(googleCalls,beforeBlank,'Blank form does not make provider requests');
      await fill(page);
      await page.getByRole('checkbox',{name:/Remember my business/}).setChecked(remember);
      await page.getByRole('checkbox',{name:/Save my details/}).setChecked(record);
      if(version==='v2'&&width===320){
        await solve(page);
        await page.setViewportSize({width:390,height:900});
        await page.waitForFunction(()=>document.querySelector('.recaptcha-checkbox__widget input')?.checked===false);
        assert.equal(await page.getByLabel('Business email',{exact:true}).inputValue(),values['Business email']);
        await page.setViewportSize({width,height:900});
        await page.waitForFunction(()=>document.querySelector('.recaptcha-checkbox__widget input')?.checked===false);
      }
      const beforeSubmissions=submissions,beforeRecords=records;
      if(version==='v2'){
        const beforeUnchecked=googleCalls;
        await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
        await page.getByRole('alert').filter({hasText:'Please complete'}).waitFor();
        assert.equal(googleCalls,beforeUnchecked,'Unchecked v2 cannot reach the provider or save data');
        if(width===1440&&!remember&&!record){
          await solve(page);await page.evaluate(()=>window.__expireCaptcha());
          await page.getByRole('alert').filter({hasText:'expired'}).waitFor();
          assert.equal(await page.getByRole('checkbox',{name:"I'm not a robot",exact:true}).isChecked(),false);
          await solve(page);await page.evaluate(()=>window.__errorCaptcha());
          await page.getByRole('alert').filter({hasText:'could not connect'}).waitFor();
          await page.getByRole('button',{name:'Retry security check',exact:true}).click();
          await page.getByRole('checkbox',{name:"I'm not a robot",exact:true}).waitFor();
          assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),values['Your name']);
        }
      }
      if(remember&&record){
        const bypass=await page.request.post(origin+'/api/client-profile',{headers:{origin},data:{profile:{name:values['Your name'],company:values.Company,website:'example.com',role:'Tester',businessEmail:values['Business email']},consent:true,confirmed:true}});
        assert.equal(bypass.status(),401);
        for(const rejection of ['low','failure']){
          mode=rejection;
          await solve(page);
          await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
          await page.getByRole('alert').first().waitFor();
          assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),values['Your name']);
          assert.equal(await page.locator('.area').count(),0);
          assert.equal(submissions,beforeSubmissions);assert.equal(records,beforeRecords);
          assert.equal((await page.request.get(origin+'/api/client-profile')).status(),404);
          assert.equal((await(await page.request.get(origin+'/api/access/status')).json()).authenticated,false);
        }
      }
      if(width===1440&&!remember&&!record){
        // A failed SDK load must be retryable without losing form data.
        blockScript=true;await page.reload({waitUntil:'networkidle'});await fill(page);
        if(version==='v3')await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
        await page.getByRole('alert').first().waitFor();assert.equal(await page.locator('.area').count(),0);
        assert.equal(await page.getByLabel('Business email',{exact:true}).inputValue(),values['Business email']);
        blockScript=false;
        if(version==='v2')await page.getByRole('button',{name:'Retry security check',exact:true}).click();
      }
      if(width===1440&&remember&&!record){
        if(version==='v3'){
        const beforeTimeout=googleCalls;
        await page.evaluate(()=>{window.__captchaHang=true;});
        await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
        await page.getByRole('alert').waitFor();
        assert.equal(googleCalls,beforeTimeout,'A hung SDK cannot submit the form');
        assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),values['Your name']);
        await page.evaluate(()=>{window.__captchaHang=false;window.__lateCaptcha('late-result-after-timeout');});
        assert.equal(googleCalls,beforeTimeout,'A late result cannot reopen a timed-out submission');
        }
        await page.route('**/api/client-profile',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic profile save failure.'})}):route.continue());
        mode='ok';await solve(page);await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();await page.getByRole('alert').first().waitFor();
        assert.equal(await page.locator('.area').count(),0,'Profile failure preserves the entry form');
        await page.unroute('**/api/client-profile');
      }
      mode='ok';const beforeCalls=googleCalls;
      await solve(page);
      await page.getByRole('button',{name:'Continue to calculator',exact:true}).click();
      if(version==='v3'){
        await page.getByRole('button',{name:'Checking security…',exact:true}).waitFor();
        assert.equal(await page.getByLabel('Your name',{exact:true}).isDisabled(),true);
      }
      await page.locator('.area').first().waitFor();
      assert.equal(await page.locator('.area').count(),12);assert.equal(googleCalls,beforeCalls+1,'One fresh CAPTCHA per submission, including remembering a profile');
      if(version==='v3')assert.equal(await page.evaluate(()=>window.__captchaAction),'calculator_entry');
      assert.equal(submissions,beforeSubmissions+Number(record));
      assert.equal((await page.request.get(origin+'/api/client-profile')).status(),remember?200:404);
      const{area,process_confirmed,...answers}=fixture;
      const result=await page.request.post(origin+'/api/journey/calculate',{headers:{origin},data:{area,answers,confirmed:process_confirmed}});
      assert.equal(result.status(),200);assert.equal((await result.json()).result.build,11500);
      assert.equal(records,beforeRecords+Number(record));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.getByRole('button',{name:'End session',exact:true}).click();await page.getByRole('button',{name:'Continue to calculator',exact:true}).waitFor();
      assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),'');
      assert.equal(await page.getByRole('checkbox',{name:/Remember my business/}).isChecked(),false);
      assert.equal(await page.getByRole('checkbox',{name:/Save my details/}).isChecked(),false);
      if(remember){
        await page.getByRole('button',{name:'Forget saved details',exact:true}).click();
        await page.getByRole('status').filter({hasText:'Saved profile removed.'}).waitFor();
      }
      if(!blockScript&&!(width===1440&&!remember&&!record))assert.equal(scripts,1,'StrictMode and logout do not duplicate SDK loads');
      assert.deepEqual(errors,[]);
      console.log(`PASS: reCAPTCHA ${version} ${width}px remember=${remember}, record=${record}; fresh token, correct writes, calculation, retry and logout.`);
    }finally{
      const status=await context.request.get(origin+'/api/client-profile/status').then(response=>response.json()).catch(()=>({}));
      await context.request.delete(origin+'/api/client-profile',{headers:{origin,'if-match':status.revision||''}}).catch(()=>{});
      await context.close();
    }
  }
  console.log(`PASS: Real React/Node reCAPTCHA ${version} flow, all saving choices, unchecked/expired/error handling, provider/SDK/profile failures, fresh retries, protected profiles, branded disclosure and desktop/mobile layout. No external providers or production writes.`);
}finally{
  await browser.close();globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
