(function(root){
const nullable=(type,values)=>({type:[type,'null'],...(values?{enum:[...values,null]}:{})});
const enums={service:['workflow','agent'],area:['Accounting, Billing & Finance','Orders, Inventory & Fulfillment','Customer Service & Returns','Sales & Customer Relationships','People, Payroll & HR','Back Office & Administration','Storefront & Conversion','Content Machine & Social Publishing','SEO & GEO','Email & Lifecycle Marketing','Paid Advertising','Another Business Process'],steps:['The same steps','A few variations','Many exceptions','Not sure'],exceptions:['Flag it for a person','Use a few agreed exception routes','Different decisions across several teams or situations','Not sure'],sourceAnswer:['Clear and current','Partial / outdated','Little or none','Not sure'],actionAnswer:['Prepare drafts / recommendations for staff approval','Make changes after staff approval','Act automatically within agreed limits','Recommend an approach / not sure'],changeImpact:['Yes','No','Not sure'],impact:['low','medium','high','unknown'],legacy:['no','yes','unsure'],trainingAudience:['One person','One team','Several teams','Not sure'],cadence:['monthly','weekly','daily','realtime'],management:['yes','no'],tier:['standard','priority','critical'],replacePortion:['all','part','unknown'],replaceSoftware:['yes','no','unknown'],softwareMode:['none','known','unknown'],approvals:['one','channel','multiple'],publishing:['drafts','schedule','publish'],reporting:['none','summary','dashboard','analysis'],seoExecution:['recommend','implement'],deliveryMode:['maintenance','managed']};
const catalogSource=typeof module==='object'?require('./catalog.js').catalog:(root.AOCDept?.data.catalog||(typeof CATALOG!=='undefined'?CATALOG:[]));
enums.task=[...new Set(catalogSource.map(t=>t.task))];
const questionBank=typeof module==='object'?require('./catalog.js').questions:(root.AOCDept?.data.questions||(typeof QUESTION_CHOICES!=='undefined'?Object.entries(QUESTION_CHOICES).flatMap(([profile,answers])=>answers.map(answer=>({profile,answer}))):[]));
enums.taskAnswer=[...new Set(questionBank.filter(q=>!['steps','exceptions','agent'].includes(q.profile)).map(q=>q.answer))];enums.agentDecision=questionBank.filter(q=>q.profile==='agent').map(q=>q.answer);
const strings=['outcome','appNames','legacyName','legacyVersion','legacyAction','volumePeriod','reportFrequency'];
const numbers=['people','hours','rate','volume','providerFee','providerRemoved','softwareSaving','vendor','brands','languages','initialPages','keywords','markets','competitors','monthlyPages','monthlyArticles','monthlyOutputs'];
const arrays=['teams','capabilities','channels','formats','sources','reportMetrics','currentHandlers'];
const properties={};for(const [k,v]of Object.entries(enums))properties[k]=nullable('string',v);for(const k of strings)properties[k]=nullable('string');for(const k of numbers)properties[k]=nullable('number');for(const k of arrays)properties[k]={type:'array',items:{type:'string'}};
const record={type:'object',properties:{field:{type:'string',enum:Object.keys(properties)},quote:{type:'string'}},required:['field','quote'],additionalProperties:false};
const schema={type:'object',properties:{title:{type:'string'},summary:{type:'string'},responsibilities:{type:'array',items:{type:'string'}},scope:{type:'object',properties,required:Object.keys(properties),additionalProperties:false},evidence:{type:'array',items:record},inferences:{type:'array',items:{type:'object',properties:{field:{type:'string',enum:Object.keys(properties)},reason:{type:'string'}},required:['field','reason'],additionalProperties:false}},questions:{type:'array',items:{type:'string'}},boundaries:{type:'array',items:{type:'string'}}},required:['title','summary','responsibilities','scope','evidence','inferences','questions','boundaries'],additionalProperties:false};
function validate(input,transcript,catalog){
 if(!input||typeof input!=='object'||!input.scope)throw Error('AI did not return a scope.');
 const out={...input,scope:{}};for(const [k,spec]of Object.entries(properties)){const v=input.scope[k];if(v===null||v===undefined){out.scope[k]=null;continue;}if(arrays.includes(k)){if(!Array.isArray(v)||v.some(x=>typeof x!=='string'||x.length>200)||v.length>30)throw Error('Invalid scope list: '+k);out.scope[k]=[...new Set(v)];continue;}if(numbers.includes(k)){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e7)throw Error('Invalid number: '+k);}else if(typeof v!=='string'||v.length>6000)throw Error('Invalid text: '+k);if(spec.enum&&!spec.enum.includes(v))throw Error('Unknown choice: '+k);out.scope[k]=v;}
 if(out.scope.area&&out.scope.task&&!catalog.some(t=>t.area===out.scope.area&&t.task===out.scope.task)){out.scope.task=null;out.scope.taskAnswer=null;}
 const anchor=catalog.find(t=>t.area===out.scope.area&&t.task===out.scope.task);if(anchor&&out.scope.taskAnswer&&!questionBank.some(q=>q.profile===anchor.profile&&q.answer===out.scope.taskAnswer))out.scope.taskAnswer=null;
 for(const key of ['responsibilities','questions','boundaries','evidence','inferences'])if(!Array.isArray(input[key])||input[key].length>30)throw Error('Invalid AI summary.');
 if(typeof input.title!=='string'||input.title.length>200||typeof input.summary!=='string'||input.summary.length>6000)throw Error('Invalid AI summary text.');
 out.inferences=input.inferences.filter(e=>properties[e.field]&&typeof e.reason==='string'&&e.reason.length<6000);
 const normalize=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
 out.evidence=input.evidence.filter(e=>properties[e.field]&&typeof e.quote==='string'&&e.quote.trim()&&normalize(transcript).includes(normalize(e.quote)));
 if(out.evidence.length<input.evidence.length)out.boundaries=[...input.boundaries,'Some extracted facts could not be matched to your explanation. They remain unknown until you confirm them.'];
 // Unsupported business facts must remain unknown. Classification choices can be inferred, visibly.
 const facts=[...numbers,'appNames','legacyName','legacyVersion','legacyAction','sourceAnswer','management','tier','replacePortion','replaceSoftware','softwareMode','teams','currentHandlers','brands','languages'];
 for(const k of facts){const v=out.scope[k];if(v!==null&&(!Array.isArray(v)||v.length)&&!out.evidence.some(e=>e.field===k)){out.scope[k]=Array.isArray(v)?[]:null;}}
 // Recover explicit arrangements from corroborating facts rather than asking again.
 const cite=key=>out.evidence.find(e=>e.field===key);
 if(!out.scope.currentHandlers?.length){
  const handlers=[];const h=cite('hours'),provider=cite('providerFee');
  if(out.scope.hours!==null&&h&&/internal|our team|staff|employee|in.house/i.test(h.quote)){handlers.push('internal');out.evidence.push({field:'currentHandlers',quote:h.quote});}
  if(out.scope.providerFee!==null&&provider&&/AOC|agency|provider|freelanc|retainer/i.test(provider.quote)){handlers.push(/AOC|Always Open Commerce/i.test(provider.quote)?'aoc':'provider');out.evidence.push({field:'currentHandlers',quote:provider.quote});}
  if(handlers.length){out.scope.currentHandlers=handlers;out.inferences=[...out.inferences,{field:'currentHandlers',reason:'Current internal work and provider arrangements were derived from the hours and fee statements quoted above. Please confirm.'}];}
 }
 const tierEvidence=cite('tier');if(out.scope.management===null&&out.scope.tier&&tierEvidence&&/monthly|support|coverage|management/i.test(tierEvidence.quote)){
  out.scope.management='yes';out.evidence.push({field:'management',quote:tierEvidence.quote});out.inferences=[...out.inferences,{field:'management',reason:'Your named monthly support tier was treated as a request for an AOC-managed estimate. You can change this before calculating.'}];
 }
 return out;
}
const api={enums,strings,numbers,arrays,properties,schema,validate};if(typeof module==='object')module.exports=api;else root.AOCIntake=api;
})(typeof globalThis!=='undefined'?globalThis:this);
