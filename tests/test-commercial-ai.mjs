import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import route from '../api/journey/analyze.mjs';

if (!process.argv.includes('--live')) {
  console.error('Opt-in only: node --env-file=.env.local tests/test-commercial-ai.mjs --live (two paid synthetic requests).');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) throw Error('Configure the server key before the opt-in test.');
process.env.AOC_AI_ORGANIZER_ENABLED = 'true';
const report = { testedAt:new Date().toISOString(), target:'local current API code with live OpenAI provider; not the deployed pricing version', syntheticDataOnly:true, providerRequests:0, cases:[] };
const cases = [
  {
    name:'Support agent with explicitly selected monthly program', area:'area2',
    text:"We need an AI agent to draft replies in Help Scout using approved policies. A person must approve every reply. We want an ongoing development program toward a broader connected system and have chosen AOC's Level 1 monthly build program. AOC quoted a fixed initial audit fee of $1,250. We have not agreed any combined monthly hours or an agency rate. Our team manages it. This is our first AOC agreement.",
    expected:{action_mode:'draft',implementation_route:'monthly',monthly_plan:'level1',audit_fee:'1250'},
    unknown:['agreed_monthly_hours','agreed_agency_blend','audit_sent_date','implementation_acceptance_date','first_implementation_payment_date','audit_credit_used','audit_accepted_route'],
  },
  {
    name:'Fixed project; budget and staff cost do not select a program or agency rate', area:'area0',
    text:'We want one limited fixed-price project to automate monthly invoices in Wave, with draft invoice outputs for our staff to approve. 3 people in 1 finance team do the work. We chose the fixed-price project route, not a monthly program. AOC quoted a fixed audit fee of $900 and a project implementation fee of $6,000, with preparation included at $0 and no additional live training. Our team will manage the finished system. Our current internal staff cost is $50/hour. Our budget is $7,000; this is not an accepted monthly program. We have not paid the audit or accepted an implementation quote yet.',
    expected:{implementation_route:'project',audit_fee:'900'},
    unknown:['monthly_plan','agreed_monthly_hours','agreed_agency_blend','audit_sent_date','implementation_acceptance_date','first_implementation_payment_date','audit_credit_used','audit_accepted_route'],
  },
];
for (const scenario of cases) {
  console.log(`RUN: ${scenario.name}`);
  report.providerRequests += 1;
  let analysis;
  try {
    const origin='https://local-aoc-test.invalid';
    const response=await route.fetch(new Request(`${origin}/api/journey/analyze`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({area:scenario.area,text:scenario.text})}));
    assert.equal(response.status,200,'live provider/API response');
    const data=await response.json();
    assert.ok(data.analysis && !data.localFallback);
    analysis=data.analysis;
    const facts=Object.fromEntries(analysis.facts.map(fact=>[fact.id,fact.value]));
    for(const [key,value] of Object.entries(scenario.expected)) assert.equal(facts[key],value,key);
    for(const key of scenario.unknown) assert.equal(facts[key],undefined,`${key} must remain unknown`);
    for(const fact of analysis.facts) assert.ok(scenario.text.includes(fact.quote),'exact contiguous evidence');
    report.cases.push({name:scenario.name,status:'PASS',facts});
    console.log(`PASS: ${scenario.name}`);
  } catch(error) {
    report.cases.push({name:scenario.name,status:'FAIL',error:error.message,facts:analysis?.facts});
    console.log(`FAIL: ${scenario.name}: ${error.message}`);
  }
}
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/commercial-ai-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.cases.some(test=>test.status==='FAIL')) process.exitCode=1;
