async function journeyAPI(request,env,url){
 if(request.method!=='POST')return json({error:'Use POST.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Use this estimator page.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 if(env.AOC_AI_ORGANIZER_ENABLED!=='true'||!env.OPENAI_API_KEY)return json({localFallback:true,mode:'local'},200);
 if(Number(request.headers.get('content-length')||0)>50000)return json({error:'Please shorten the description.'},413);
 let body;try{const raw=await request.text();if(raw.length>30000)throw Error();body=JSON.parse(raw);}catch{return json({error:'Could not read the request.'},400);}
 if(!AOCBank.areas.some(a=>a.id===body.area)||typeof body.text!=='string'||body.text.trim().length<30||body.text.length>18000)return json({error:'Choose an area and describe the process in 30–18,000 characters.'},400);
 const id='journey:'+(request.headers.get('oai-authenticated-user-id')||'public-pilot'),now=Date.now();for(const [k,v]of buckets)if(now-v.start>3600000)buckets.delete(k);const bucket=buckets.get(id)||{start:now,count:0};if(bucket.count>=30)return json({error:'Analysis limit reached for this preview. Use editable fields or try later.'},429);bucket.count++;buckets.set(id,bucket);
 try{
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.AOC_INTAKE_MODEL||'gpt-5.4',store:false,instructions:AOCJourneyContract.prompt(body.area),input:body.text,max_output_tokens:9000,text:{format:{type:'json_schema',name:'aoc_journey_scope',strict:true,schema:AOCJourneyContract.schema(body.area)}}}),signal:AbortSignal.timeout(55000)});
 const p=await response.json();if(!response.ok)return json({error:'AI could not complete this request. Your text is preserved; use editable fields or retry.'},response.status===429?429:502);
 if(p.status!=='completed')return json({error:'AI response was incomplete. Shorten the description or use editable fields.'},502);
 const text=(p.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 return json({analysis:AOCJourneyContract.validate(JSON.parse(text),body.text,body.area),version:AOCBank.version});
 }catch{return json({error:'Analysis could not be validated or timed out. Your description is preserved; continue with editable fields.'},502);}
}
