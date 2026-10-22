const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../public/journey-engine.js'),B=require('../public/approved-bank.js'),C=require('../public/journey-contract.js'),K=require('../public/journey-calculation.js');
const base={area:'area0',solution:'workflow',steps_band:3,variation_band:3,documentation_readiness:'Notes or examples',data_preparation_level:'Some preparation',systems:['Hubstaff Time','Wave','Google Docs','Google Drive','Help Scout','Stripe'],action_mode:'approved',consequential:'yes',people_count:3,department_count:2,handover:'group',legacy_system_check:'Standard',process_confirmed:true,cadence:'monthly',management:'no',team_time:40,blended_hourly_cost:50,software_replaced_portion:'none',incremental_software_cost:0};
const x=E.calculate(base);assert.equal(x.build,11500);assert.equal(x.audit,1150);assert.equal(x.monthly,0);assert.equal(x.freed,32);assert.equal(x.retained,8);assert.equal(x.capacity,1600);assert.equal(x.net,1600);assert.equal(x.yearInvestment,11500);assert.equal(x.yearNet,7700);assert.equal(x.payback,7.1875);
const documentedFixture=E.calculate({...base,management:'yes',tier:'priority'});assert.equal(documentedFixture.build,11500);assert.equal(documentedFixture.audit,1150);assert.equal(documentedFixture.monthly,550);assert.equal(documentedFixture.freed,32);assert.equal(documentedFixture.retained,8);assert.equal(documentedFixture.capacity,1600);assert.equal(documentedFixture.net,1050);assert.equal(documentedFixture.yearInvestment,18100);assert.equal(documentedFixture.yearGross,19200);assert.equal(documentedFixture.yearNet,1100);assert.ok(Math.abs(documentedFixture.payback-10.9523809524)<1e-9);
let prev=-1;for(const tier of ['standard','priority','critical']){const v=E.calculate({...base,management:'yes',tier});assert.ok(v.monthly>prev);prev=v.monthly;assert.equal(v.yearInvestment,v.build+12*v.recurring);assert.equal(v.yearNet,12*v.net-v.build);assert.equal(v.audit,v.build*.1);}
assert.equal(E.calculate({...base,management:null}).monthly,null);assert.equal(E.calculate({...base,management:null}).payback,null);assert.equal(E.calculate({...base,team_time:null}).capacity,null);assert.equal(E.calculate({...base,incremental_software_cost:null}).net,null);assert.equal(E.calculate({...base,software_replaced_portion:null}).net,null);assert.equal(E.calculate({...base,software_replaced_cost:0,software_replaced_portion:'all'}).software,0);
assert.equal(E.calculate({...base,legacy_system_check:'Older'}).build,null);assert.equal(E.calculate({...base,feasibility:'blocked'}).audit,null);assert.equal(E.calculate({...base,people_count:0}).build,null);assert.equal(E.calculate({...base,people_count:-1}).build,null);
const legacyRestricted=E.calculate({...base,legacy_system_check:'Restricted'});assert.equal(legacyRestricted.build,null);assert.equal(legacyRestricted.audit,null);assert.equal(legacyRestricted.feasibility,'Needs connection review');
const appBlocked=E.calculate({...base,app_known_restrictions:'Provider restrictions'});assert.equal(appBlocked.build,null);assert.equal(appBlocked.audit,null);assert.equal(appBlocked.feasibility,'Needs connection review');
const dataBlocked=E.calculate({...base,data_material_restriction:'Missing'});assert.equal(dataBlocked.build,null);assert.equal(dataBlocked.audit,null);assert.equal(dataBlocked.feasibility,'Potential blocker');
assert.equal(E.calculate({...base,data_material_restriction:'Unavailable'}).build,null);assert.equal(E.calculate({...base,data_material_restriction:'Access denied'}).build,null);
assert.equal(E.calculate({...base,data_material_conflict:'Source records disagree'}).build,null);assert.equal(E.calculate({...base,app_known_restrictions:'None known',data_material_restriction:'Available',data_material_conflict:'No known conflict'}).build,11500);
assert.equal(E.calculate({...base,legacy_system_check:null}).build,null);
assert.equal(E.calculate({...base,legacy_system_check:'Not sure'}).build,null);assert.equal(E.calculate({...base,data_preparation_level:null}).build,null);
const marketingBase={...base,area:'area7',capability_count:1,channel_count:2,format_count:2,brand_count:1,language_count:1,delivery_mode:'maintenance'};
assert.notEqual(E.calculate(marketingBase).build,null);assert.equal(E.calculate({...marketingBase,brand_count:null}).build,null);assert.equal(E.calculate({...marketingBase,language_count:null}).build,null);
const seoBase={...base,area:'area8',capability_count:1,brand_count:1,language_count:1,initial_pages:0,keyword_count:0,market_count:1,delivery_mode:'maintenance'};
assert.notEqual(E.calculate(seoBase).build,null);assert.equal(E.calculate({...seoBase,initial_pages:null}).build,null);assert.equal(E.calculate({...seoBase,keyword_count:null}).build,null);
const agent=E.calculate({...base,solution:'agent',decision_band:3,management:'yes',tier:'priority'});assert.ok(agent.build>x.build);assert.equal(agent.monthly,null);assert.equal(require('../public/approved-pricing.js').marketing.monthly.agent,null);
const neg=E.calculate({...base,team_time:1,management:'yes',tier:'critical'});assert.ok(neg.net<0);assert.equal(neg.payback,null);assert.ok(neg.yearNet<0);
assert.equal(B.areas.length,12);assert.ok(B.areas.every(a=>a.fields.length>0));assert.ok(B.appNames.length>250);for(const a of B.areas){assert.equal(new Set(a.fields.map(f=>f.id)).size,a.fields.length);assert.ok(C.fields(a.id).length>a.fields.length);assert.ok(C.schema(a.id).properties.facts.items.properties.id.enum.includes('team_time'));}
const text='We create 40 invoices in Wave each month.';const analysis={title:'Billing',summary:'Invoice preparation',solution:'workflow',recommendationReason:'Defined steps',classification:{steps:2,variations:null,decisions:null,reason:'Several steps'},routes:[],facts:[{id:'invoice_volume',value:'40',quote:'40 invoices'},{id:'people_count',value:'3',quote:'three people'},{id:'fake_key',value:'1',quote:'Wave'}],relevantFields:['invoice_volume','fake_key'],uncertainties:[]};const out=C.validate(analysis,text,'area0');assert.equal(out.facts.length,1);assert.deepEqual(out.relevantFields,['invoice_volume']);
const {area:baseArea,process_confirmed:baseConfirmed,...baseAnswers}=base;const authoritative=K.calculate({area:'area0',confirmed:true,answers:{...baseAnswers,responsibility_split:'client',management:'yes'}});assert.equal(authoritative.result.build,11500);assert.equal(authoritative.result.monthly,0);assert.equal(authoritative.version,B.version);
assert.throws(()=>K.calculate({area:'unknown',confirmed:true,answers:{}}),/valid business area/);assert.throws(()=>K.calculate({area:'area0',confirmed:true,answers:{people_count:-1}}),/nonnegative/);assert.throws(()=>K.calculate({area:'area0',confirmed:true,answers:{legacy_system_check:'INVALID'}}),/Invalid choice/);assert.throws(()=>K.calculate({area:'area0',confirmed:true,answers:{data_preparation_level:'INVALID'}}),/Invalid choice/);assert.throws(()=>K.calculate({area:'area0',confirmed:true,answers:{steps_band:5}}),/between 1 and 4/);assert.throws(()=>K.calculate({area:'area0',confirmed:true,answers:{fake_field:'value'}}),/Unknown calculation field/);assert.throws(()=>K.calculate({area:'area0',confirmed:'yes',answers:{}}),/Confirm whether/);
const worker=fs.readFileSync('dist/server/index.js','utf8');assert.ok(worker.includes('/api/journey/analyze'));assert.ok(worker.includes('SECTION 7')===false);assert.ok(worker.includes('Responsibilities and ongoing service.'));

const normalized=C.validate({...analysis,facts:[{id:'blended_hourly_cost',value:'$40',quote:'40 invoices'},{id:'software_replaced_cost',value:'No',quote:'We are not replacing apps'},{id:'customer_type',value:'UNKNOWN',quote:'Wave'}]},text+' We are not replacing apps','area0');assert.equal(normalized.facts.find(f=>f.id==='blended_hourly_cost').value,'40');assert.equal(normalized.facts.find(f=>f.id==='software_replaced_portion').value,'none');assert.ok(!normalized.facts.some(f=>f.id==='customer_type'));

// Unknown responsibility is not an explicit request to choose a management arrangement.
function responsibilityFacts(quote,value='help') {
 return C.validate({...analysis,facts:[{id:'responsibility_split',value,quote}]},quote,'area0').facts;
}
for(const quote of [
 'Our team repeats administrative work and wants to reduce manual effort. We do not yet know the systems, people count, number of departments, frequency, costs, or who should manage it. Please help us identify the missing details.',
 'We do not know who should manage this process.',
 'Please help us identify missing details about who should manage it.',
 'Please help us choose advertising channels. We do not know who should manage it.',
 'Please recommend questions to ask. Management responsibility is unknown.',
 'We do not need help deciding who should manage it.',
]) assert.deepEqual(responsibilityFacts(quote),[], 'unsupported responsibility remains unanswered: '+quote);
for(const quote of [
 'Please help us decide who should manage it.',
 'Help me choose between AOC and our team.',
 'We need help deciding the management responsibilities.',
 'Please recommend who should manage this process.',
 'We need guidance on who will maintain the system.',
 'Please help me decide who should be responsible for this process.',
 'Please recommend how ongoing maintenance should be managed.',
]) assert.equal(responsibilityFacts(quote)[0]?.value,'help','explicit management help is preserved: '+quote);
assert.equal(responsibilityFacts('AOC manages the process.','aoc')[0]?.value,'aoc');
assert.equal(responsibilityFacts('Our team manages the process.','client')[0]?.value,'client');
assert.equal(responsibilityFacts('We share responsibility with AOC.','shared')[0]?.value,'shared');

// Human approval alone must not promote drafting to system execution.
function actionFacts(quote,value) {
 return C.validate({...analysis,facts:[{id:'action_mode',value,quote}]},quote,'area1').facts;
}
for(const quote of [
 'A person must approve every reply.',
 'Use approved policy documents to draft replies.',
 'Prepare drafts for a person to approve.',
]) assert.deepEqual(actionFacts(quote,'approved'),[], 'approval without an action cannot select approved execution: '+quote);
assert.deepEqual(actionFacts('A person must approve every reply.','Approved'),[], 'alternate capitalization cannot bypass the execution evidence check');
for(const quote of [
 'Draft replies in Help Scout. A person must approve every reply.',
 'Prepare invoice drafts for our team to approve before sending.',
 'Automatically prepare draft replies for human review.',
]) assert.equal(actionFacts(quote,'draft')[0]?.value,'draft');
for(const quote of [
 'After approval, the agent sends the reply.',
 'Make changes only after our approval.',
 'The system drafts replies, then sends them once approved.',
 'Publish the article after sign-off.',
 'Create invoices only after our approval.',
]) assert.equal(actionFacts(quote,'approved')[0]?.value,'approved','explicit approved execution stays supported: '+quote);
assert.equal(actionFacts('Send routine replies automatically within agreed limits.','automatic')[0]?.value,'automatic');
const advertisingDescription='We want reporting and approved campaign updates as 2 capabilities in one connected workflow. Make changes only after our approval.';
assert.deepEqual(C.validate({...analysis,facts:[{id:'action_mode',value:'approved',quote:'approved campaign updates. Make changes only after our approval.'}]},advertisingDescription,'area10').facts,[], 'stitched evidence is still rejected');
assert.equal(C.validate({...analysis,facts:[{id:'action_mode',value:'approved',quote:'Make changes only after our approval.'}]},advertisingDescription,'area10').facts[0]?.value,'approved', 'one continuous sufficient quote preserves approved changes');

// Documented acceptance scenarios: representative areas and approved pricing drivers.
const financeArea=B.areas.find(a=>a.id==='area0'),contentArea=B.areas.find(a=>a.id==='area7'),seoArea=B.areas.find(a=>a.id==='area8'),otherArea=B.areas.find(a=>a.id==='area11');
assert.ok(financeArea.routes.includes('Create and send invoices'));assert.ok(financeArea.routes.includes('Process supplier bills / vendor invoices'));
assert.ok(contentArea.routes.length>1);assert.ok(seoArea.routes.length>1);assert.equal(otherArea.routes.length,1);assert.ok(otherArea.fields.length>0);
const contentBank=JSON.stringify(contentArea).toLowerCase();assert.ok(contentBank.includes('blog'));assert.ok(contentBank.includes('linkedin'));assert.ok(contentBank.includes('company / individual / both'));
assert.equal(E.calculate({...base,invoice_volume:10000}).build,x.build,'Volume context alone must not invent a multiplier.');
for(const changed of [
  {...base,variation_band:4},
  {...base,people_count:16},
  {...base,department_count:4},
  {...base,handover:'multiple'},
  {...base,systems:[...base.systems,'Shopify']},
]) assert.ok(E.calculate(changed).build>x.build,'Each approved complexity driver should affect build pricing.');
assert.ok(E.calculate({...marketingBase,channel_count:3}).build>E.calculate(marketingBase).build);
assert.ok(E.calculate({...marketingBase,format_count:3}).build>E.calculate(marketingBase).build);
const seoMaintenance=E.calculate({...seoBase,management:'yes',tier:'priority',delivery_mode:'maintenance'});
const seoManaged=E.calculate({...seoBase,management:'yes',tier:'priority',delivery_mode:'managed',monthly_pages:2,monthly_articles:1});
assert.ok(seoManaged.monthly>seoMaintenance.monthly,'Managed SEO delivery must remain distinct from maintenance.');
assert.equal(E.calculate({...base,area:'area11'}).build,x.build,'Another-process scopes use the approved shared pricing drivers.');
console.log('PASS: journey pricing, representative area scenarios, approved pricing drivers, unknown/zero handling, ROI, blockers, agent pricing hold, 12 banks, and extraction validation.');
