// Exercise the actual app event handlers, form serialization and rendered result.
// Minimal DOM adapter; not a substitute for visual browser QA.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const els=new Map();let currentContainer=null;
class Element{
 constructor(id,type='',name=''){Object.assign(this,{id,type,name,value:'',checked:false,disabled:false,hidden:false,textContent:'',parentElement:{hidden:false},style:{},dataset:{},listeners:{},classList:{toggle(){}},_html:''});els.set(id,this);}
 set innerHTML(html){
  this._html=html;
  for(const [id,el] of els)if(el.container===this.id)els.delete(id);
  for(const match of html.matchAll(/<(input|select|textarea|p|div)\b([^>]*)>/g)){
   const attrs=match[2],id=attrs.match(/\bid="([^"]+)"/)?.[1];if(!id)continue;
   const type=attrs.match(/\btype="([^"]+)"/)?.[1]||match[1],name=attrs.match(/\bname="([^"]+)"/)?.[1]||'';
   const el=new Element(id,type,name);el.container=this.id;el.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';
  }
 }
 get innerHTML(){return this._html;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(){} reportValidity(){return true;} scrollIntoView(){} close(){} showModal(){}
 reset(){for(const el of els.values())if(el.name){el.value='';el.checked=false;}}
}
for(const m of fs.readFileSync('dist/index.html','utf8').matchAll(/\bid="([^"]+)"/g))new Element(m[1]);els.get('service').name='service';els.get('service').type='hidden';
const document={getElementById:id=>els.get(id),querySelectorAll:()=>[],querySelector:q=>q.startsWith('[name=')?[...els.values()].find(e=>e.name===q.match(/"([^"]+)"/)[1]):new Element('temporary-label')};
class FormDataAdapter{
 constructor(){this.entries=[...els.values()].filter(e=>e.name&&!e.disabled&&(e.type!=='checkbox'||e.checked)).map(e=>[e.name,String(e.value)]);}
 [Symbol.iterator](){return this.entries[Symbol.iterator]();}getAll(k){return this.entries.filter(([name])=>name===k).map(([,v])=>v);}
}
const ctx={document,FormData:FormDataAdapter,AOC:require('../dist/engine.js'),AOCDept:require('../dist/department.js'),structuredClone,Intl,localStorage:{getItem(){return null;},setItem(){},removeItem(){}},matchMedia:()=>({matches:false}),setTimeout(){},window:{},navigator:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),value=(id,v)=>{els.get(id).value=String(v);},event=(type,id)=>els.get('calculator').listeners[type]({target:els.get(id),preventDefault(){}}),submit=()=>{event('submit','calculator');return JSON.parse(run('JSON.stringify(last.result)'));};
run("choose('workflow')");
// Load a complete generic business intake using the current department catalog.
const t=ctx.AOCDept.data.catalog[0];
value('area',t.area);event('change','area');value('task',t.task);event('change','task');
for(const [k,v] of Object.entries({taskAnswer:ctx.AOCDept.options(t.profile)[0].answer,steps:'The same steps',exceptions:'Flag it for a person',sourceAnswer:'Clear and current',appNames:'Gmail, Drive, Sheets',people:1,trainingAudience:'One person',actionAnswer:'Prepare drafts / recommendations for staff approval',changeImpact:'No',reviewRoute:'Supported route verified',hours:40,rate:60}))value(k,v);
const team=new Element('test-team','checkbox','teams');team.checked=true;team.value='Accounting';
value('management','yes');event('change','management');value('tier','priority');event('change','tier');
assert.match(els.get('monthlyStatus').textContent,/No default fee/);
assert.equal(els.get('monthlyTest').parentElement.hidden,false);
assert.equal(submit().capacity,1920);assert.equal(submit().net,null);
assert.match(els.get('output').innerHTML,/monthly service test fee/);
// Per-tier test fees survive tier changes and manage/self-manage toggles.
value('monthlyTest',400);event('input','monthlyTest');value('vendor',100);event('input','vendor');
let r=submit();assert.equal(r.build,1750);assert.equal(r.monthly,400);assert.equal(r.recurring,500);assert.equal(r.net,1420);assert.equal(r.yearInvestment,7750);assert.equal(r.yearNet,15290);assert.equal(r.payback,1750/1420);
assert.match(els.get('economicsPreview').textContent,/\$1,420/);
value('tier','critical');event('change','tier');assert.equal(els.get('monthlyTest').value,'');value('monthlyTest',800);event('input','monthlyTest');assert.equal(submit().monthly,800);
value('tier','priority');event('change','tier');assert.equal(Number(els.get('monthlyTest').value),400);assert.equal(submit().monthly,400);
value('management','no');event('change','management');r=submit();assert.equal(r.monthly,0);assert.equal(r.recurring,100);assert.equal(r.net,1820);
value('management','yes');event('change','management');assert.equal(submit().monthly,400);
// Explicit $0 software costs; disabled field omitted by FormData but normalized to 0.
els.get('noVendorCost').checked=true;event('change','noVendorCost');r=submit();assert.equal(r.vendor,0);assert.equal(r.net,1520);
els.get('noVendorCost').checked=false;event('change','noVendorCost');assert.equal(submit().vendor,100);
// Clearing a field really removes it; missing economics do not block the build.
value('hours','');event('input','hours');r=submit();assert.equal(r.build,1750);assert.equal(r.capacity,null);assert.equal(r.net,null);
value('hours',0);value('rate',0);r=submit();assert.equal(r.capacity,0);assert.equal(r.net,-500);assert.equal(r.payback,null);
// Defaults in the rule editor are used; a blank scope override must not erase them.
run('rules.monthly.standard=250');value('tier','standard');event('change','tier');assert.equal(Number(els.get('monthlyTest').value),250);
value('monthlyTest','');assert.equal(submit().monthly,250);
// Workspace benefits require an explicit retained-time assumption.
run("choose('team')");value('hours',40);value('rate',60);assert.equal(submit().capacity,null);value('retainedOverride',50);assert.equal(submit().capacity,1200);
// Reset removes draft fees and the explicit software-zero selection.
els.get('clearBtn').onclick();assert.equal(els.get('vendor').disabled,false);assert.equal(els.get('noVendorCost').checked,false);assert.equal(run('last'),null);assert.match(els.get('output').innerHTML,/Ready when you are/);
console.log('ROI and monthly UI event tests passed: managed, all tiers, self-managed, fee persistence/defaults, software zero, missing/zero economics, workspace ROI, reset.');
