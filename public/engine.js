(function(root){
const defaults={version:'AOC working rules · 15 Oct 2026 · v6',core:{simple:1500,moderate:3500,complex:6000,advanced:9000},agent:{simple:1000,moderate:2000,complex:3500,advanced:5000},prep:{clean:0,partial:1000,limited:2000,unknown:2000},includedSystems:3,connection:500,controls:1500,department:500,rolloutMedium:500,rolloutLarge:1500,handover:{one:250,group:500,multiple:1000},team:3500,google:2500,audit:.1,retained:.2,low:.2,high:.25,creditDays:30,monthly:{standard:null,priority:null,critical:null}};
const number=v=>v===null||v===undefined||v===''?null:Number(v);
function calculate(s,r=defaults){
 const lines=[],pending=[],warnings=[],errors=[];let known=0;
 const add=(label,amount)=>{lines.push({label,amount});known+=amount;};
 const n=k=>number(s[k]);
 for(const [k,v] of Object.entries(s))if(typeof v==='number'&&(!Number.isFinite(v)||v<0))errors.push('Use nonnegative, finite values for '+k+'.');
 for(const k of ['people','departments','systems','assistants','volume','users','mailboxes'])if(n(k)!==null&&!Number.isInteger(n(k)))errors.push(k+' must be a whole number.');
 if(!s.service)pending.push('Choose a service.');
 if(['workflow','agent'].includes(s.service)){
  if(!s.level)pending.push('Choose the process complexity.');else {add('Core '+s.level+' process build',r.core[s.level]);if(s.service==='agent')add('Additional agent design & evaluation (provisional)',r.agent[s.level]);}
  if(!s.readiness||s.readiness==='unknown')pending.push('Source readiness needs review.');else add('Bounded source preparation',r.prep[s.readiness]);
  if(n('systems')===null)pending.push('Enter the number of connected business systems.');else add('Additional supported systems beyond '+r.includedSystems,Math.max(0,n('systems')-r.includedSystems)*r.connection);
  if(!s.controls)pending.push('Choose the action-control requirement.');else add('Consequential-action safeguards',s.controls==='yes'?r.controls:0);
  if(n('people')===null||n('people')<1)pending.push('Enter at least one person in scope.');else add('People / adoption rollout',n('people')>15?r.rolloutLarge:n('people')>=5?r.rolloutMedium:0);
  if(n('departments')===null||n('departments')<1)pending.push('Enter at least one department.');else add('Departments beyond two',Math.max(0,n('departments')-2)*r.department);
  if(!s.handover)pending.push('Choose the handover deliverable.');else add('Training & handover',r.handover[s.handover]);
  if(s.connectionType==='custom'){if(n('customFee')===null)pending.push('Custom integration allowance is unpriced.');else {const generic=Math.max(0,(n('systems')||0)-r.includedSystems)*r.connection;known-=generic;lines.splice(lines.findIndex(x=>x.label.startsWith('Additional supported')),1);add('Custom integration allowance (replaces generic extra-system fee)',n('customFee'));warnings.push('Custom integration allowance is a manual test amount. Confirm exact included systems.');}}
  if(!s.connectionType)pending.push('Choose the integration route.');
 }
 if(['team','google'].includes(s.service)){
  add(s.service==='team'?'Team AI starting package':'Google Workspace starting package',r[s.service]);
  if(n('people')===null||n('people')<1||n('departments')===null||n('departments')<1)pending.push('Enter people and departments in scope.');
  if(!s.platform)pending.push('Select the platform / setup situation.');
  if(!s.readiness)pending.push('Describe the existing source condition.');
  if(!s.expanded)pending.push('Confirm any additional cleanup or training.');
  const extra=(n('people')||0)>10||(n('departments')||0)>2||(s.service==='team'&&(n('assistants')===null||(n('assistants')||0)>2))||s.expanded==='yes'||s.readiness==='limited'||s.readiness==='unknown';
  if(extra&&n('scopeFee')===null)pending.push('Expanded scope needs a manually scoped test allowance.');
  if(n('scopeFee')!==null){add('Additional scoped work — manual test allowance',n('scopeFee'));warnings.push('Expanded-scope amount is a manual test allowance, not a calibrated multiplier.');}
  if(s.service==='google'&&!s.domainCount)pending.push('Confirm domain scope.');
  if(s.domainCount==='multiple'&&n('scopeFee')===null)pending.push('Additional domains need scoped pricing.');
  if(s.migration==='yes'&&n('migrationFee')===null)pending.push('Migration is selected but unpriced.');
  if(s.migration==='yes'&&n('migrationFee')!==null){add('Migration — manual test allowance',n('migrationFee'));warnings.push('Migration price is manually scoped for testing.');}
  if(!s.migration)pending.push('Confirm whether migration is needed.');
 }
 if(s.service==='migration'||s.service==='knowledge'){
  const fields=s.service==='migration'?['planningFee','transferFee','validationFee']:['prepareFee','developFee','matrixFee','retrievalFee','updateFee','trainingFee'];
  const labels=s.service==='migration'?['Migration planning','Transfer & permission mapping','Validation & handover']:['Prepare existing knowledge','Develop missing source documents','Source / project matrices','Retrieval & access testing','Update / ingestion infrastructure','Training & handover'];
  fields.forEach((f,i)=>n(f)===null?pending.push(labels[i]+' has no scoped test price.'):add(labels[i]+' — manual test amount',n(f)));
  if(s.service==='migration'&&(!s.from||!s.to||!s.workloads))pending.push('Describe migration source, destination and workloads.');
  warnings.push('This service has no approved pricing coefficients. Enter component amounts to simulate; explicit zero means included / not required.');
 }
 if(n('adjustment')!==null&&n('adjustment')>0){add('Other documented scope — manual test allowance',n('adjustment'));warnings.push('Additional scope is manually priced for this test.');}
 const build=pending.length||errors.length?null:known;
 const monthly=s.management==='no'?0:s.management==='yes'&&s.tier?number(r.monthly[s.tier]):null;
 const vendor=n('vendor'),hours=n('hours'),rate=n('rate');
 const workspace=['team','google','knowledge','migration'].includes(s.service);
 const retained=workspace?(n('retainedOverride')===null?null:n('retainedOverride')/100):r.retained;
 const capacity=hours===null||rate===null||retained===null?null:hours*(1-retained)*rate;
 const recurring=monthly===null||vendor===null?null:monthly+vendor;
 const net=capacity===null||recurring===null?null:capacity-recurring;
 return {lines,known,build,audit:build===null?null:Math.round(build*r.audit*100)/100,low:build===null?null:Math.round(build*(1-r.low)/100)*100,high:build===null?null:Math.round(build*(1+r.high)/100)*100,pending,errors,warnings,monthly,vendor,capacity,recurring,net,payback:build!==null&&net>0?build/net:null,yearInvestment:build!==null&&recurring!==null?build+12*recurring:null,yearNet:build!==null&&net!==null?net*12-build:null,retainedHours:hours===null||retained===null?null:hours*retained,freedHours:hours===null||retained===null?null:hours*(1-retained),workspace};
}
const api={defaults,calculate,number};if(typeof module==='object')module.exports=api;else root.AOC=api;
})(typeof globalThis!=='undefined'?globalThis:this);
