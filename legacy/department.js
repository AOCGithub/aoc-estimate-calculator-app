(function(root){
'use strict';
const data=typeof module==='object'?require('../public/catalog.js'):root.AOCData;
const core=typeof module==='object'?require('../public/engine.js'):root.AOC;
const levelNames=['simple','moderate','complex','advanced'];
const areas=[...new Set(data.catalog.map(t=>t.area))];
const options=profile=>data.questions.filter(q=>q.profile===profile);
const tasks=area=>data.catalog.filter(t=>t.area===area);
const task=(area,name)=>data.catalog.find(t=>t.area===area&&t.task===name);
const band=(profile,answer)=>options(profile).find(q=>q.answer===answer)?.band;
function countNames(value){const list=Array.isArray(value)?value.join(','):String(value||'');if(!list.trim()||/not sure|unknown/i.test(list))return null;return new Set(list.split(/[,;\n]+/).map(x=>x.trim().toLowerCase()).filter(Boolean)).size||null;}
function derive(input){
 const s={...input},pending=[],warnings=[];const selected=task(s.area,s.task);
 if(!s.area)pending.push('Choose the business area you want to improve.');
 if(!selected)pending.push('Choose a task for the selected business area.');
 const q=selected?band(selected.profile,s.taskAnswer):undefined,steps=band('steps',s.steps),exceptions=band('exceptions',s.exceptions),ai=s.service==='agent'?band('agent',s.agentDecision):1;
 if(selected&&q===undefined)pending.push('Answer the task-specific question, or select Not sure.');
 if(steps===undefined)pending.push('Tell us whether this follows the same steps.');
 if(exceptions===undefined)pending.push('Choose how unusual cases should be handled.');
 if(s.service==='agent'&&ai===undefined)pending.push('Tell us what the AI should help decide.');
 let derived=selected&&[q,steps,exceptions,ai].every(Number.isFinite)?Math.max(q,steps,exceptions,ai):null;
 const minimum=levelNames.indexOf(String(s.reviewMinLevel||'').toLowerCase())+1;
 if(derived!==null)derived=Math.max(derived,minimum);
 const appCount=s.appsUnknown==='yes'?null:countNames(s.appNames);
 const teamNames=[...(Array.isArray(s.teams)?s.teams:(s.teams?[s.teams]:[])),s.otherTeams||''];
 const teamCount=s.teamsUnknown==='yes'?null:countNames(teamNames);
 const readiness={'Clear and current':'clean','Partial / outdated':'partial','Little or none':'limited','Not sure':'limited'}[s.sourceAnswer]||'';
 const handover={'One person':'one','One team':'group','Several teams':'multiple','Not sure':'group'}[s.trainingAudience]||'';
 const draft=s.actionAnswer==='Prepare drafts / recommendations for staff approval';
 const controls=s.actionAnswer&&s.changeImpact?(draft||s.changeImpact==='No'?'no':'yes'):'';
 const route=s.reviewRoute==='Custom / legacy connection'?'custom':'supported';
 const normalized={...s,level:derived===null?'':levelNames[derived-1],readiness,systems:appCount,departments:teamCount,handover,controls,connectionType:route,customFee:s.reviewCustomFee,apps:s.appNames};
 if(s.sourceAnswer==='Not sure')warnings.push('Document condition is unknown. The explicit preparation allowance is an assumption to review.');
 if([s.taskAnswer,s.steps,s.exceptions,s.agentDecision,s.actionAnswer,s.changeImpact,s.trainingAudience].some(v=>v&&/not sure/i.test(v)))warnings.push('Some answers are uncertain. Stated scope / handover assumptions need review.');
 if(!s.reviewRoute||s.reviewRoute!=='Supported route verified')warnings.push('App connections are a pricing assumption until AOC verifies the required actions and access.');
 if(selected?.task==='Something else / not sure')warnings.push('This uses general scope questions. AOC must review the process before a final quote.');
 return {normalized,pending,warnings,selected,derived,appCount,teamCount,unknownPrep:s.sourceAnswer==='Not sure'};
}
function calculate(input,rules=core.defaults){
 if(!['workflow','agent'].includes(input.service))return core.calculate(input,rules);
 const derived=derive(input),r=structuredClone(rules);
 if(derived.unknownPrep)r.prep.limited=r.prep.unknown??2000;
 const result=core.calculate(derived.normalized,r);
 const friendly={
 'Choose the process complexity.':'Complete the task and variation questions.',
 'Source readiness needs review.':'Tell us about the instructions or examples you have.',
 'Enter the number of connected business systems.':'List the apps used, or leave this estimate partial until the app list is known.',
 'Choose the action-control requirement.':'Tell us who approves changes and whether they affect money, orders, stock or sensitive records.',
 'Enter at least one person in scope.':'Enter the number of people currently involved.',
 'Enter at least one department.':'Select the teams involved, or leave the estimate partial until they are known.',
 'Choose the handover deliverable.':'Choose who needs to learn how to use or manage it.',
 'Custom integration allowance is unpriced.':'AOC review: the selected custom connection still needs a scoped test amount.'
 };
 result.pending=[...new Set([...derived.pending,...result.pending.map(x=>friendly[x]||x)])];
 result.warnings=[...new Set([...result.warnings,...derived.warnings])];
 if(result.pending.length||result.errors.length){result.build=null;result.audit=null;result.low=null;result.high=null;result.yearInvestment=null;result.yearNet=null;result.payback=null;}
 const uncertain=[input.taskAnswer,input.steps,input.exceptions,input.agentDecision,input.actionAnswer,input.changeImpact,input.trainingAudience,input.sourceAnswer].some(v=>v&&/not sure/i.test(v));
 result.needsReview=result.build===null||input.evidence!=='tested'||input.reviewRoute!=='Supported route verified'||uncertain||derived.selected?.task==='Something else / not sure';
 result.reviewStatus=input.evidence==='blocked'?'Known blocker — do not offer audit purchase':result.needsReview?'AOC scope / connection review required before audit purchase':'Reviewer signoff reported — verify supporting evidence';
 result.derived={level:derived.normalized.level,apps:derived.appCount,teams:derived.teamCount,task:derived.selected?.task,area:input.area};
 return result;
}
const api={data,areas,options,tasks,task,countNames,derive,calculate};if(typeof module==='object')module.exports=api;else root.AOCDept=api;
})(typeof globalThis!=='undefined'?globalThis:this);
