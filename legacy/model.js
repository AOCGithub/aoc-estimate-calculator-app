(function(root){
const Dept=typeof module==='object'?require('./department.js'):root.AOCDept,Core=typeof module==='object'?require('../public/engine.js'):root.AOC;
const defaults={version:'V8 draft calibration · 15 October 2026',build:{capability:400,channel:350,format:400,source:450,brand:750,language:500,approval:500,publishing:500,seoPage:15,keyword:3,website:1000,market:400,reportDashboard:200,reportAnalysis:600,reportMetric:100,competitor:100},monthly:{base:100,simple:75,moderate:125,complex:225,advanced:350,agent:100,extraApp:25,extraTeam:25,daily:50,realtime:100,standard:0,priority:150,critical:450,extraChannel:15,extraFormat:15,extraCapability:20,extraBrand:50,extraLanguage:25,reportWeekly:50,reportDaily:100},delivery:{contentOutput:15,seoPage:15,seoArticle:80,otherOutput:20,report:50}};
const marketing=['Content Machine & Social Publishing','SEO & GEO','Email & Lifecycle Marketing','Paid Advertising','Storefront & Conversion'];
const list=v=>Array.isArray(v)?[...new Set(v)]:v?[v]:[];
const num=Core.number;
function calculate(s,coreRules=Core.defaults,pricing=defaults){
 const scope={...s};if(marketing.includes(s.area)&&s.area!=='Storefront & Conversion')scope.taskAnswer=scope.taskAnswer||Dept.options('generic')[0].answer;
 const result=Dept.calculate(scope,coreRules),extra=[];
 for(const key of ['brands','languages','markets','initialPages','keywords','monthlyPages','monthlyArticles','monthlyOutputs','competitors'])if(num(s[key])!==null&&!Number.isInteger(num(s[key])))result.errors.push(key+' must be a whole number.');
 if(list(s.currentHandlers).some(x=>['new','unknown'].includes(x))&&list(s.currentHandlers).length>1)result.errors.push('Choose either who handles the work today, or that it is new / unknown.');const missing=[];const add=(label,amount)=>{if(amount>0)extra.push({label,amount});};
 const positive=(key,label)=>{const v=num(s[key]);if(v===null||v<1)missing.push(label);return v||0;};
 const isContent=s.area==='Content Machine & Social Publishing',isSEO=s.area==='SEO & GEO',isProcess=['workflow','agent'].includes(s.service);
 const chosen=list(s.capabilities),channels=list(s.channels),formats=list(s.formats),sources=list(s.sources);
 if(isProcess&&!s.impact)missing.push('Tell us what would happen if this process stopped.');
 if(isProcess&&!s.legacy)missing.push('Tell us whether older or custom technology is involved.');
 if(isProcess&&s.legacy==='yes'&&!String(s.legacyName||'').trim())missing.push('Name the older / custom system so we can check it.');
 if(isContent||isSEO){
  if(!chosen.length)missing.push('Select at least one system capability.');
  add('Additional system capabilities',Math.max(0,chosen.length-1)*pricing.build.capability);
  const brands=positive('brands',isSEO?'Enter websites in scope.':'Enter brands in scope.'),langs=positive('languages','Enter languages in scope.');
  add(isSEO?'Additional websites':'Additional brands',Math.max(0,brands-1)*(isSEO?pricing.build.website:pricing.build.brand));add('Additional languages',Math.max(0,langs-1)*pricing.build.language);
  if(isContent){
   if(!channels.length)missing.push('Choose at least one destination channel.');if(!formats.length)missing.push('Choose at least one output format.');if(!sources.length)missing.push('Choose your source material, or select help developing sources.');
   add('Additional channels beyond two',Math.max(0,channels.length-2)*pricing.build.channel);add('Additional formats beyond two',Math.max(0,formats.length-2)*pricing.build.format);add('Additional source routes beyond two',Math.max(0,sources.length-2)*pricing.build.source);
   if(!s.approvals)missing.push('Choose the content approval process.');add('Additional approval routing',s.approvals==='multiple'?pricing.build.approval*2:s.approvals==='channel'?pricing.build.approval:0);
   if(!s.publishing)missing.push('Choose what happens after content approval.');add('Scheduling / publishing setup',s.publishing==='drafts'?0:s.publishing?pricing.build.publishing:0);
  }else{
   const pageWork=chosen.some(x=>['Existing-page optimization','New search content','Internal linking / site structure','Structured data','GEO content readiness'].includes(x));
   if(pageWork){const pages=positive('initialPages','Enter initial pages in scope.');add('Initial page scope beyond ten',Math.max(0,pages-10)*pricing.build.seoPage);}
   if(chosen.includes('Research / planning')||chosen.includes('Monitoring / reporting')){const k=positive('keywords','Enter topics / keywords to research or track.');add('Topics / keywords beyond twenty',Math.max(0,k-20)*pricing.build.keyword);}
   const markets=positive('markets','Enter target markets in scope.');add('Additional markets',Math.max(0,markets-1)*pricing.build.market);
   if(!s.seoExecution)missing.push('Choose whether AOC recommends or implements changes.');add('Approved implementation setup',s.seoExecution==='implement'?pricing.build.publishing:0);
  }
  if(!s.reporting)missing.push('Choose the reporting format.');
  if(s.reporting&&s.reporting!=='none'){add('Additional reporting measures beyond two',Math.max(0,list(s.reportMetrics).length-2)*pricing.build.reportMetric);if(list(s.reportMetrics).includes('Competitor comparison')){const competitors=positive('competitors','Enter competitors to compare.');add('Additional competitor comparisons',Math.max(0,competitors-1)*pricing.build.competitor);}}
  add('Reporting setup',s.reporting==='analysis'?pricing.build.reportAnalysis:s.reporting==='dashboard'?pricing.build.reportDashboard:0);
 }
 result.lines.push(...extra);result.known+=extra.reduce((t,x)=>t+x.amount,0);result.pending=[...new Set([...result.pending,...missing])];
 result.build=result.pending.length||result.errors.length?null:result.known;result.audit=result.build===null?null:Math.round(result.build*coreRules.audit*100)/100;
 result.low=result.build===null?null:Math.round(result.build*(1-coreRules.low)/100)*100;result.high=result.build===null?null:Math.round(result.build*(1+coreRules.high)/100)*100;
 const tier=s.tier,monthlyLines=[];const mAdd=(label,amount)=>{if(amount)monthlyLines.push({label,amount});};
 let monthly=s.management==='no'?0:null;
 if(s.management==='yes'&&tier&&['standard','priority','critical'].includes(tier)){
  const level=result.derived?.level||'moderate',apps=result.derived?.apps||0,teams=result.derived?.teams||0;
  mAdd('Process management',pricing.monthly.base);mAdd('Scoped maintenance',pricing.monthly[level]);mAdd('Agent oversight',s.service==='agent'?pricing.monthly.agent:0);mAdd('Additional app dependencies',Math.max(0,apps-3)*pricing.monthly.extraApp);mAdd('Additional teams',Math.max(0,teams-2)*pricing.monthly.extraTeam);mAdd('Operating frequency',pricing.monthly[s.cadence]||0);mAdd('Selected coverage',pricing.monthly[tier]);
  if(isContent||isSEO){mAdd('Additional capabilities',Math.max(0,chosen.length-1)*pricing.monthly.extraCapability);mAdd('Additional brands / websites',Math.max(0,(num(s.brands)||1)-1)*pricing.monthly.extraBrand);mAdd('Additional languages',Math.max(0,(num(s.languages)||1)-1)*pricing.monthly.extraLanguage);if(isContent){mAdd('Additional channels',Math.max(0,channels.length-2)*pricing.monthly.extraChannel);mAdd('Additional formats',Math.max(0,formats.length-2)*pricing.monthly.extraFormat);}if(s.reporting&&s.reporting!=='none')mAdd('Reporting cadence',s.reportFrequency==='Weekly'?pricing.monthly.reportWeekly:s.reportFrequency==='Daily dashboard'?pricing.monthly.reportDaily:0);}
  if(marketing.includes(s.area)&&s.deliveryMode==='managed'){
   if(isSEO){if(num(s.monthlyPages)===null||num(s.monthlyArticles)===null)missing.push('Enter ongoing page and article volumes (zero if none).');mAdd('Managed page optimization',(num(s.monthlyPages)||0)*pricing.delivery.seoPage);mAdd('Managed article production',(num(s.monthlyArticles)||0)*pricing.delivery.seoArticle);}
   else{if(num(s.monthlyOutputs)===null)missing.push('Enter the monthly content / deliverable volume.');mAdd('Managed production & review',(num(s.monthlyOutputs)||0)*(isContent?pricing.delivery.contentOutput:pricing.delivery.otherOutput));}
   mAdd('Managed reporting',s.reporting&&s.reporting!=='none'?pricing.delivery.report:0);
  }
  monthly=monthlyLines.reduce((t,x)=>t+x.amount,0);
  if(marketing.includes(s.area)&&!s.deliveryMode)monthly=null;
  if(missing.some(x=>/ongoing page|monthly content/.test(x)))monthly=null;
  if(isProcess&&(!result.derived?.level||!result.derived?.apps||!result.derived?.teams||!s.cadence))monthly=null;
 }
 result.monthly=monthly;result.monthlyLines=monthlyLines;
 result.vendor=s.softwareMode==='none'?0:s.softwareMode==='known'?num(s.vendor):null;
 const hasInternal=!marketing.includes(s.area)||list(s.currentHandlers).includes('internal');const handlers=list(s.currentHandlers),hasProvider=marketing.includes(s.area)&&handlers.some(x=>['aoc','provider'].includes(x));
 const h=hasInternal?num(s.hours):0,rate=hasInternal?num(s.rate):0;
 const retained=['team','google','migration','knowledge'].includes(s.service)?(num(s.retainedOverride)===null?null:num(s.retainedOverride)/100):coreRules.retained;
 const unknownArrangement=marketing.includes(s.area)&&(!handlers.length||handlers.includes('unknown')||handlers.includes('new'));
 const internalValue=h===null||rate===null?null:h*rate;
 const capacity=internalValue===null||retained===null?null:internalValue*(1-retained);
 let providerCurrent=hasProvider?num(s.providerFee):0,providerRemoved=hasProvider?(s.replacePortion==='all'?providerCurrent:s.replacePortion==='part'?num(s.providerRemoved):null):0;
 if(providerCurrent!==null&&providerRemoved!==null&&providerRemoved>providerCurrent)result.errors.push('Provider fees replaced cannot exceed the current provider fee.');
 const softwareSaving=s.replaceSoftware==='no'?0:s.replaceSoftware==='yes'?num(s.softwareSaving):null;
 const recurring=monthly===null||result.vendor===null?null:monthly+result.vendor;
 const gross=unknownArrangement||capacity===null||providerRemoved===null||softwareSaving===null?null:capacity+providerRemoved+softwareSaving;
 const cash=unknownArrangement||providerRemoved===null||softwareSaving===null||recurring===null?null:providerRemoved+softwareSaving-recurring;
 const net=gross===null||recurring===null?null:gross-recurring;
 const invalid=result.errors.length>0;
 Object.assign(result,{capacity:unknownArrangement?null:capacity,retainedHours:h===null||retained===null||unknownArrangement?null:h*retained,freedHours:h===null||retained===null||unknownArrangement?null:h*(1-retained),internalValue:unknownArrangement?null:internalValue,providerCurrent,providerRemoved,softwareSaving,gross,recurring,net:invalid?null:net,cash:invalid?null:cash,payback:!invalid&&result.build!==null&&net>0?result.build/net:null,yearInvestment:!invalid&&result.build!==null&&recurring!==null?result.build+12*recurring:null,yearNet:!invalid&&result.build!==null&&net!==null?12*net-result.build:null,currentComparable:unknownArrangement||internalValue===null||providerRemoved===null||softwareSaving===null?null:internalValue+providerRemoved+softwareSaving,proposedComparable:unknownArrangement||internalValue===null||capacity===null||recurring===null?null:internalValue-capacity+recurring});
 result.needsReview=true;result.reviewStatus=s.legacy==='yes'||s.legacy==='unsure'?'Connection check needed: '+(s.legacyName||'system to identify'):'App actions and permissions require validation';
 if(s.legacy==='yes'||s.legacy==='unsure')result.warnings.push('Older/custom technology is a feasibility flag, not automatic rejection. AOC must check the required read/write actions before offering an audit.');
 if(unknownArrangement)result.warnings.push('No reliable current-cost baseline supplied. Savings and payback remain unknown.');
 result.warnings.push('Monthly and expanded-service coefficients are draft calibration assumptions for this private preview, not approved client rates.');
 if(result.errors.length){result.build=null;result.audit=null;result.low=null;result.high=null;result.payback=null;result.yearNet=null;result.yearInvestment=null;}
 return result;
}
const api={defaults,marketing,list,calculate};if(typeof module==='object')module.exports=api;else root.AOCModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
