(function(root){
const Bank=typeof module==='object'?require('./approved-bank.js'):root.AOCBank;
const Contract=typeof module==='object'?require('./journey-contract.js'):root.AOCJourneyContract;
const Engine=typeof module==='object'?require('./journey-engine.js'):root.AOCJourneyEngine;
const numericIds=new Set(['steps_band','variation_band','decision_band','people_count','department_count','incremental_software_cost','provider_removed_amount','software_removed_amount','capability_count','channel_count','format_count','brand_count','language_count','initial_pages','keyword_count','market_count','monthly_outputs','monthly_pages','monthly_articles','team_time','blended_hourly_cost','replacement_provider_cost','software_replaced_cost']);
const integerIds=new Set(['steps_band','variation_band','decision_band','people_count','department_count','capability_count','channel_count','format_count','brand_count','language_count','initial_pages','keyword_count','market_count','monthly_outputs','monthly_pages','monthly_articles']);
const strictChoices={
 solution:['workflow','agent'],action_mode:['draft','approved','automatic'],consequential:['yes','no'],handover:['one','group','multiple'],cadence:['monthly','weekly','daily','realtime'],
 legacy_system_check:['Standard','Customized','Older','Restricted','Not sure'],documentation_readiness:['Clear and current','Partial documentation','Notes or examples','Mostly staff knowledge','Not sure'],
 data_preparation_level:['Mostly ready','Some preparation','Substantial preparation','Not sure'],responsibility_split:['aoc','client','shared','help'],tier:['standard','priority','critical'],
 provider_replaced_portion:['none','all','part','unknown'],software_replaced_portion:['none','all','part','unknown'],delivery_mode:['maintenance','managed'],response_need:['next','hours','urgent','recommend']
};
function cleanValue(id,value){
 if(value===null||value===undefined||value==='')return null;
 if(numericIds.has(id)){const number=Number(value);if(!Number.isFinite(number)||number<0)throw Error('Use a nonnegative number for '+id+'.');if(integerIds.has(id)&&!Number.isInteger(number))throw Error('Use a whole number for '+id+'.');if(['steps_band','variation_band','decision_band'].includes(id)&&(number<1||number>4))throw Error(id+' must be between 1 and 4.');return number;}
 if(Array.isArray(value)){if(id!=='systems'||value.some(item=>typeof item!=='string'))throw Error('Invalid value for '+id+'.');return value.slice(0,100).map(item=>item.trim().slice(0,300)).filter(Boolean);}
 if(typeof value==='boolean')throw Error('Invalid value for '+id+'.');
 if(typeof value!=='string')throw Error('One or more answers could not be read.');
 const cleaned=value.trim().slice(0,5000);if(strictChoices[id]&&!strictChoices[id].includes(cleaned))throw Error('Invalid choice for '+id+'.');return cleaned;
}
function calculate(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Could not read the calculation request.');
 if(typeof body.area!=='string'||!Bank.areas.some(area=>area.id===body.area))throw Error('Choose a valid business area.');
 if(!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))throw Error('Calculation answers are required.');
 if(typeof body.confirmed!=='boolean')throw Error('Confirm whether the reviewed scope is approved.');
 const allowed=new Set(Contract.fields(body.area).map(field=>field.id));
 const answers={};
 for(const [id,value] of Object.entries(body.answers)){
  if(!allowed.has(id))throw Error('Unknown calculation field: '+id+'.');
  if(id==='management')continue;
  const cleaned=cleanValue(id,value);if(cleaned!==null)answers[id]=cleaned;
 }
 if(typeof answers.systems==='string')answers.systems=answers.systems.split(/[,;\n]+/).map(item=>item.trim()).filter(Boolean).slice(0,100);
 const responsibility=answers.responsibility_split;
 const management=['aoc','shared'].includes(responsibility)?'yes':responsibility==='client'?'no':null;
 const result=Engine.calculate({...answers,area:body.area,management,process_confirmed:body.confirmed===true});
 return {result,version:Bank.version};
}
const api={calculate};if(typeof module==='object')module.exports=api;else root.AOCJourneyCalculation=api;
})(globalThis);
