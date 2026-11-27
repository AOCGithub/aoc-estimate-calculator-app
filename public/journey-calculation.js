(function(root){
const Bank=typeof module==='object'?require('./approved-bank.js'):root.AOCBank;
const Price=typeof module==='object'?require('./approved-pricing.js'):root.AOCPricing;
const Contract=typeof module==='object'?require('./journey-contract.js'):root.AOCJourneyContract;
const Engine=typeof module==='object'?require('./journey-engine.js'):root.AOCJourneyEngine;
const Commercial=typeof module==='object'?require('./commercial.js'):root.AOCCommercial;
const numericIds=new Set([...Commercial.numericIds,'steps_band','variation_band','decision_band','people_count','department_count','incremental_software_cost','provider_removed_amount','software_removed_amount','capability_count','channel_count','format_count','brand_count','language_count','initial_pages','keyword_count','market_count','monthly_outputs','monthly_pages','monthly_articles','team_time','blended_hourly_cost','replacement_provider_cost','software_replaced_cost']);
const integerIds=new Set(['steps_band','variation_band','decision_band','people_count','department_count','capability_count','channel_count','format_count','brand_count','language_count','initial_pages','keyword_count','market_count','monthly_outputs','monthly_pages','monthly_articles']);
const strictChoices={
 solution:['workflow','agent'],action_mode:['draft','approved','automatic'],consequential:['yes','no'],handover:['one','group','multiple'], cadence:['monthly','weekly','daily','hourly','realtime'],
 workspace_context:['google_workspace','microsoft_365','other','none','unknown'],
 ai_account_context:['chatgpt_personal','chatgpt_business','claude_personal','claude_team','gemini','other','none','unknown'],
 legacy_system_check:['Standard','Customized','Older','Restricted','Not sure'],documentation_readiness:['Clear and current','Partial documentation','Notes or examples','Mostly staff knowledge','Not sure'],
 data_preparation_level:['clean','existing','partial','limited','unknown'],responsibility_split:['aoc','client','shared','help'],tier:['standard','priority','premier'],
 provider_replaced_portion:['none','all','part','unknown'],software_replaced_portion:['none','all','part','unknown'],delivery_mode:['maintenance','managed'],response_need:['next','hours','urgent','recommend'],
 ...Commercial.choices
};
function cleanValue(id,value){
 if(value===null||value===undefined||value===''||(typeof value==='string'&&!value.trim()))return null;
 if(numericIds.has(id)){if(!['number','string'].includes(typeof value))throw Error('Invalid number for '+id+'.');const number=Number(value);if(!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER)throw Error('Use a representable nonnegative number for '+id+'.');if((integerIds.has(id)||['comparison_months','benefit_months'].includes(id))&&!Number.isSafeInteger(number))throw Error('Use a safe whole number for '+id+'.');if(['steps_band','variation_band','decision_band'].includes(id)&&(number<1||number>4))throw Error(id+' must be between 1 and 4.');if(['audit_fee','agreed_monthly_hours','agreed_agency_blend','comparison_months'].includes(id)&&number===0)throw Error('Use a positive number for '+id+'.');return number;}
 if(Array.isArray(value)){if(id!=='systems'||value.some(item=>typeof item!=='string'))throw Error('Invalid value for '+id+'.');return value.slice(0,100).map(item=>item.trim().slice(0,300)).filter(Boolean);}
 if(typeof value==='boolean')throw Error('Invalid value for '+id+'.');
 if(typeof value!=='string')throw Error('One or more answers could not be read.');
 const cleaned=value.trim().slice(0,5000);if(strictChoices[id]&&!strictChoices[id].includes(cleaned))throw Error('Invalid choice for '+id+'.');if(Commercial.dateIds.includes(id)&&!Commercial.date(cleaned))throw Error('Use a valid YYYY-MM-DD date for '+id+'.');return cleaned;
}
function calculate(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Could not read the calculation request.');
 if(typeof body.area!=='string'||!Price.simplified.activeAreaIds.includes(body.area))throw Error('Choose a currently available business area.');
 if(!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))throw Error('Calculation answers are required.');
 if(typeof body.confirmed!=='boolean')throw Error('Confirm whether the reviewed scope is approved.');
 const area=Bank.areas.find(candidate=>candidate.id===body.area);
 if(body.routes!==undefined&&!Array.isArray(body.routes))throw Error('Selected process steps must be a list.');
 const routes=body.routes===undefined?[]:body.routes;
 const availableRoutes=new Set([...area.routes,...area.fields.map(field=>field.route).filter(Boolean)]);
 if(routes.some(route=>typeof route!=='string'||!availableRoutes.has(route)))throw Error('One or more selected process steps are not available for this business area.');
 const selectedRoutes=[...new Set(routes)];
 const allowed=new Set([...Contract.fields(body.area).map(field=>field.id),'solution']);
 const answers={};
 for(const [id,value] of Object.entries(body.answers)){
  if(!allowed.has(id))throw Error('Unknown calculation field: '+id+'.');
  const cleaned=cleanValue(id,value);if(cleaned!==null)answers[id]=cleaned;
 }
 const result=Engine.calculate({...answers,area:body.area,process_confirmed:body.confirmed===true,selected_task_count:Math.max(1,selectedRoutes.length)});
 return {result,version:Bank.version};
}
const api={calculate};if(typeof module==='object')module.exports=api;else root.AOCJourneyCalculation=api;
})(globalThis);
