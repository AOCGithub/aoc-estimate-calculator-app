(function(root){
const Core=typeof module==='object'?require('./engine.js'):root.AOC;
const Price=typeof module==='object'?require('./approved-pricing.js'):root.AOCPricing;
const Commercial=typeof module==='object'?require('./commercial.js'):root.AOCCommercial;
const n=Core.number,levels=['simple','moderate','complex','advanced'];
function calculate(input,pricing=Price,options={}){
 const s={...input},errors=[],pending=[],warnings=[],assumptions=[],r=structuredClone(pricing.core);
 for(const [k,v] of Object.entries(s))if(typeof v==='number'&&(!Number.isFinite(v)||v<0))errors.push('Use a nonnegative finite value for '+k+'.');
 for(const k of ['capability_count','channel_count','format_count','brand_count','language_count','initial_pages','keyword_count','market_count','monthly_outputs','monthly_pages','monthly_articles'])if(n(s[k])!==null&&!Number.isInteger(n(s[k])))errors.push(k+' must be a whole number.');
 const steps=n(s.steps_band),variations=n(s.variation_band),decisions=s.solution==='agent'?n(s.decision_band):1;
 const band=[steps,variations,decisions].every(x=>Number.isInteger(x)&&x>=1&&x<=4)?Math.max(steps,variations,decisions):null;
 const ready={'Clear and current':'clean','Partial documentation':'partial','Notes or examples':'limited','Mostly staff knowledge':'limited'}[s.documentation_readiness];
 const docsUnknown=!ready;const prep=ready||'unknown';if(docsUnknown)assumptions.push('Document readiness unknown: explicit $'+r.prep.unknown+' test preparation allowance; audit validates.');
 const apps=Array.isArray(s.systems)?[...new Set(s.systems.map(x=>x.trim().toLowerCase()).filter(Boolean))]:null;
 const impact=s.action_mode==='draft'?'no':s.action_mode==='approved'||s.action_mode==='automatic'?(s.consequential==='no'?'no':s.consequential==='yes'?'yes':''):'';
 const normalized={service:s.solution,level:band===null?'':levels[band-1],readiness:prep==='unknown'?'limited':prep,systems:apps?.length||null,controls:impact,people:n(s.people_count),departments:n(s.department_count),handover:s.handover,connectionType:'supported'};
 if(docsUnknown)r.prep.limited=r.prep.unknown;
 const result=Core.calculate(normalized,r);pending.push(...result.pending);errors.push(...result.errors);
 if(!['workflow','agent'].includes(s.solution))pending.push('Confirm the recommended solution.');
 if(!s.process_confirmed)pending.push('Review and confirm the process scope.');
 const legacyRestricted=s.legacy_system_check==='Restricted';
 if(['Customized','Older','Restricted','Not sure'].includes(s.legacy_system_check)||!s.legacy_system_check){warnings.push('Required app actions, plan and access need verification before a paid audit is offered.');if(!s.legacy_system_check)pending.push('Confirm the app connection condition or choose Not sure.');if(s.legacy_system_check==='Not sure')pending.push('Unknown system connection is not priced: AOC connection review required.');if(s.legacy_system_check==='Customized'||s.legacy_system_check==='Older')pending.push('Custom or older system integration is not priced: AOC connection review required.');}
 const appRestriction=legacyRestricted||(typeof s.app_known_restrictions==='string'&&!/^(None known|No restrictions?|Not sure|Unknown)$/i.test(s.app_known_restrictions.trim()));
 const dataConflict=typeof s.data_material_conflict==='string'&&!/^(No known conflict|No conflict|None|Not sure|Unknown)$/i.test(s.data_material_conflict.trim());
 const dataRestriction=typeof s.data_material_restriction==='string'&&!/^(Available|No restrictions?|Not restricted|Not sure|Unknown)$/i.test(s.data_material_restriction.trim());
 const blocked=s.feasibility==='blocked'||dataConflict||dataRestriction;
 if(appRestriction){pending.push('Known app restriction requires connection review or an agreed alternative before an audit.');warnings.push('A direct connection is not assumed; AOC must confirm a supported or staff-assisted approach.');}
 if(blocked){pending.push('Known information restriction or conflict: discuss a feasible alternative before buying an audit.');warnings.push('Do not offer an audit purchase for the blocked approach.');}
 if(!s.data_preparation_level)pending.push('Confirm the preparation level or choose Not sure.');
 if(s.data_preparation_level==='Not sure')warnings.push('Data preparation needs validation during the audit.');
 if(s.data_preparation_level==='Substantial preparation')pending.push('Substantial preparation needs a bounded scope review beyond the standard allowance.');
 const lines=[...result.lines];const add=(label,amount)=>{if(amount>0)lines.push({label,amount});};
 const b=pricing.marketing.build,m=pricing.marketing.monthly,d=pricing.marketing.delivery;
 const marketing=['area6','area7','area8','area9','area10'].includes(s.area);
 if(marketing){
  const count=(key,label,unit,included=1)=>{if(n(s[key])!==null)add(label,Math.max(0,n(s[key])-included)*unit);};
  count('capability_count','Additional capabilities',b.capability);count('channel_count','Additional channels',b.channel,2);count('format_count','Additional formats',b.format,2);count('brand_count',s.area==='area8'?'Additional websites':'Additional brands',s.area==='area8'?b.website:b.brand);count('language_count','Additional languages',b.language);
  if(s.area==='area8'){count('initial_pages','Initial pages beyond ten',b.seoPage,10);count('keyword_count','Topics / keywords beyond twenty',b.keyword,20);count('market_count','Additional markets',b.market);}
  if(!s.capability_count)pending.push('Confirm the number of connected capabilities for the marketing scope.');
  if(!s.brand_count)pending.push(s.area==='area8'?'Confirm the number of websites in scope.':'Confirm the number of brands in scope.');
  if(!s.language_count)pending.push('Confirm the number of languages in scope.');
  if(s.area==='area7'&&(!s.channel_count||!s.format_count))pending.push('Confirm destination channels and output formats.');
  if(s.area==='area8'){
   if(!s.market_count)pending.push('Confirm the number of target markets.');
   if(n(s.initial_pages)===null||n(s.keyword_count)===null)pending.push('Confirm initial pages and topics or keywords; enter zero when none are included.');
  }
 }
 const uniquePending=[...new Set(pending)],known=lines.reduce((t,x)=>t+x.amount,0);
 const build=errors.length||uniquePending.length?null:known;
 let monthly=null;const monthlyParts=[];const madd=(label,amount)=>{if(amount>0)monthlyParts.push({label,amount});};
 if(s.management==='no')monthly=0;
 else if(s.management==='yes'&&['standard','priority','critical'].includes(s.tier)&&band&&apps?.length&&n(s.department_count)>0&&s.cadence){
  madd('Shared management',m.base);madd('Workflow upkeep',m[levels[band-1]]);madd('Dependencies',Math.max(0,apps.length-3)*m.extraApp);madd('Teams',Math.max(0,n(s.department_count)-2)*m.extraTeam);madd('Frequency',m[s.cadence]||0);madd('Coverage',m[s.tier]);
  if(marketing){madd('Capabilities',Math.max(0,(n(s.capability_count)||1)-1)*m.extraCapability);madd('Channels',Math.max(0,(n(s.channel_count)||2)-2)*m.extraChannel);madd('Formats',Math.max(0,(n(s.format_count)||2)-2)*m.extraFormat);madd('Brands / sites',Math.max(0,(n(s.brand_count)||1)-1)*m.extraBrand);madd('Languages',Math.max(0,(n(s.language_count)||1)-1)*m.extraLanguage);}
  if(marketing&&s.delivery_mode==='managed'){if(s.area==='area8'){if(n(s.monthly_pages)!==null&&n(s.monthly_articles)!==null){madd('Managed page work',n(s.monthly_pages)*d.seoPage);madd('Managed article work',n(s.monthly_articles)*d.seoArticle);}else warnings.push('Ongoing delivery volumes need review before monthly fee can be calculated.');}else if(n(s.monthly_outputs)!==null)madd('Managed production',n(s.monthly_outputs)*(s.area==='area7'?d.contentOutput:d.otherOutput));}
  const deliveryMissing=marketing&&(!s.delivery_mode||(s.delivery_mode==='managed'&&(s.area==='area8'?(n(s.monthly_pages)===null||n(s.monthly_articles)===null):n(s.monthly_outputs)===null)));
  if(s.solution==='agent')warnings.push('Agent upkeep requires scope-based calibration; withdrawn flat agent add-ons are not used.');
  if(!deliveryMissing&&s.solution!=='agent')monthly=monthlyParts.reduce((t,x)=>t+x.amount,0);
 }
 const hours=n(s.team_time),rate=n(s.blended_hourly_cost),vendor=n(s.incremental_software_cost);
 const freed=hours===null?null:hours*(1-r.retained),retained=hours===null?null:hours*r.retained,capacity=freed===null||rate===null?null:freed*rate;
 const replacement=(current,mode,part)=>mode==='none'?0:mode==='all'?n(current):mode==='part'?n(part):null;
 const provider=marketing?replacement(s.replacement_provider_cost,s.provider_replaced_portion,s.provider_removed_amount):0;
 const software=replacement(s.software_replaced_cost,s.software_replaced_portion,s.software_removed_amount);
 for(const [current,removed,label]of [[n(s.replacement_provider_cost),provider,'Provider'],[n(s.software_replaced_cost),software,'Software']])if(current!==null&&removed!==null&&removed>current)errors.push(label+' savings cannot exceed current cost.');
 const cash=provider===null||software===null?null:provider+software;
 const recurring=monthly===null||vendor===null?null:monthly+vendor;
 const gross=capacity===null||cash===null?null:capacity+cash;
 const net=errors.length||gross===null||recurring===null?null:gross-recurring;
 const validBuild=errors.length?null:build;
 const coverage=s.response_need==='urgent'&&s.tier!=='critical'&&s.management==='yes'?'Requested urgent coverage is not included in this selected tier; AOC must reconcile this before sale.':null;if(coverage)warnings.push(coverage);
 const draft={lines,known,build:validBuild,audit:validBuild===null?null:Math.round(validBuild*r.audit*100)/100,low:validBuild===null?null:Math.round(validBuild*(1-r.low)/100)*100,high:validBuild===null?null:Math.round(validBuild*(1+r.high)/100)*100,level:band===null?null:levels[band-1],pending:uniquePending,errors,warnings:[...new Set(warnings)],assumptions,monthly,monthlyParts,monthlyDraft:monthly>0,freed,retained,capacity,provider,software,cash,recurring,gross,net,yearInvestment:validBuild===null||recurring===null?null:validBuild+12*recurring,yearGross:gross===null?null:gross*12,yearNet:validBuild===null||net===null?null:12*net-validBuild,payback:validBuild!==null&&net>0?validBuild/net:null,vendor,coverage,feasibility:blocked?'Potential blocker':appRestriction?'Needs connection review':s.legacy_system_check==='Standard'?'Action-level verification still required':'Needs verification',auditPurchasable:false};
 return pricing.commercial?Commercial.apply(s,draft,pricing.commercial,options):draft;
}
const api={calculate};if(typeof module==='object')module.exports=api;else root.AOCJourneyEngine=api;
})(globalThis);
