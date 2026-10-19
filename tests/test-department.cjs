const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Dept=require('../dist/department.js'),AOC=require('../dist/engine.js'),cases=require('../data/department-regression.json');
let passed=0;
for(const c of cases){
const s={service:c.service==='AI agent'?'agent':'workflow',area:c.area,task:c.task,taskAnswer:c.answer,steps:c.steps,exceptions:c.exceptions,agentDecision:c.ai,sourceAnswer:c.docs,appNames:c.apps,people:c.people,teams:c.teams,trainingAudience:c.training,actionAnswer:c.actions,changeImpact:c.sensitive,reviewRoute:c.route,reviewCustomFee:c.custom===''?null:Number(c.custom)};
const actual=Dept.calculate(s);
assert.equal(actual.build,c.expected==='Pending'?null:Number(c.expected),c.id+' '+c.purpose);
if(actual.build!==null)assert.equal(actual.audit,Number(c.audit),c.id+' audit');
passed++;
}
const t=Dept.data.catalog[0],q=Dept.options(t.profile)[0];
const base={service:'workflow',area:t.area,task:t.task,taskAnswer:q.answer,steps:'The same steps',exceptions:'Flag it for a person',sourceAnswer:'Clear and current',appNames:'Gmail, Drive, Sheets',people:1,teams:['Accounting'],trainingAudience:'One person',actionAnswer:'Prepare drafts / recommendations for staff approval',changeImpact:'No',reviewRoute:'Supported route verified',management:'no',vendor:0,hours:25,rate:40};
assert.equal(Dept.calculate(base).build,1750);
assert.equal(Dept.calculate({...base,volume:50000}).build,1750);
assert.equal(Dept.calculate({...base,area:'Marketing & Content'}).build,null);
assert.equal(Dept.calculate({...base,taskAnswer:'invalid old answer'}).build,null);
assert.equal(Dept.calculate({...base,appsUnknown:'yes'}).build,null);
assert.equal(Dept.calculate({...base,teamsUnknown:'yes'}).build,null);
assert.equal(Dept.calculate({...base,reviewMinLevel:'advanced'}).build,9250);
assert.equal(Dept.calculate({...base,management:'yes',tier:'critical'}).monthly,null);
assert.equal(Dept.calculate({...base,hours:null}).capacity,null);
assert.equal(Dept.calculate({...base,evidence:'blocked'}).reviewStatus,'Known blocker — do not offer audit purchase');
const edited=structuredClone(AOC.defaults);edited.core.simple=2000;assert.equal(Dept.calculate(base,edited).build,2250);
const source=fs.readFileSync('dist/app.js','utf8');const functions=source.slice(source.indexOf('function field('),source.indexOf('function choose('));
class El{constructor(){this.value='';this.innerHTML='';this.hidden=false;this.disabled=false;this.textContent='';}}
const els=Object.fromEntries(['area','task','taskAnswer','taskQuestion','volume','volumePeriod'].map(x=>[x,new El()]));const labels={};
const ctx={AOCDept:Dept,$:id=>els[id],esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),document:{querySelector:q=>labels[q]??(labels[q]=new El())}};
vm.createContext(ctx);vm.runInContext(functions,ctx);
for(const area of Dept.areas){els.area.value=area;els.task.value='stale';els.taskAnswer.value='stale';els.volume.value='999';ctx.refreshDepartment('area');assert.equal(els.task.value,'');assert.equal(els.taskAnswer.value,'');assert.equal(els.volume.value,'');for(const task of Dept.tasks(area)){els.task.value=task.task;ctx.refreshDepartment('task');assert.equal(els.taskAnswer.value,'');assert.equal(els.taskQuestion.hidden,false);assert.equal(labels['label[for="taskAnswer"]'].textContent,task.question);assert.equal(labels['label[for="volume"]'].textContent,task.volumeLabel);for(const opt of Dept.options(task.profile))assert(els.taskAnswer.innerHTML.includes(ctx.esc(opt.answer)));}}
for(const service of ['workflow','agent']){const html=ctx.departmentFields(service);for(const forbidden of ['Process complexity','Connected business systems','Integration route','Consequential actions / safeguards','Custom integration allowance'])assert(!html.includes(forbidden),forbidden);assert(html.includes('Which apps or tools'));assert(html.includes('Which teams take part?'));assert.equal(html.includes('name="agentDecision"'),service==='agent');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);}
assert(!source.includes("field('level','Process complexity'"));assert(source.includes("AOCDept.calculate(s,testRules)"));
console.log(`${passed} Sheet parity cases passed; 11 extra calculation checks; all 63 dependent task/question/volume routes and client wording checked.`);
