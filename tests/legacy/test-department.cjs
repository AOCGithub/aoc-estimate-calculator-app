const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const AOC=require('../../public/engine.js'),cases=require('../../data/department-regression.json');
const catalog=require('../../data/catalog-v6.json');
const scope=vm.createContext({AOCData:catalog,AOC,structuredClone});
vm.runInContext(fs.readFileSync(require.resolve('../../legacy/department.js'),'utf8'),scope);
const Dept=scope.AOCDept;
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
console.log(`${passed} historical Sheet parity cases and 11 additional department calculations passed.`);
