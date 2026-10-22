import { hours, money, normalizeAnswers } from '../lib/format.js';
import { estimatorBank } from '../lib/domain.js';

function Metric({ title, value, note = '' }) {
  return <div className="metric"><div className="metric-title">{title}</div><div className="value">{value}</div>{note && <p>{note}</p>}</div>;
}
const reviewedMoney = value => value === null || value === undefined ? 'Needs AOC review' : money(value);

function downloadSummary(state, area) {
  const scope = normalizeAnswers(state.answers);
  if (state.result.route === 'monthly') {
    for (const key of ['preparation_fee', 'implementation_fee', 'live_training', 'live_training_fee']) delete scope[key];
  }
  const report = {
    version: estimatorBank.version, description: state.description, area: area.label,
    scope, routes: state.routes, result: state.result,
    calculationSource: state.calculationSource, notice: state.result.commercialNotice,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aoc-estimate-review.json';
  link.click();
  URL.revokeObjectURL(url);
}

function Result({ state, area }) {
  const result = state.result;
  if (!result) return <>
    <h2>A clear picture,<br />one process at a time.</h2>
    <p>Your estimate appears here after you review the details and calculate.</p>
    <div className="empty-stat">Fixed project or monthly build program</div>
    <div className="empty-stat">Separately quoted initial audit</div>
    <div className="empty-stat">Time and potential value</div>
  </>;
  const monthlyProgram = result.route === 'monthly';
  const attention = [...result.errors, ...result.pending];
  const smallerBillingWorkflow = area.id === 'area0' && state.answers.solution === 'workflow' && ['simple', 'moderate'].includes(result.level);
  return <>
    <h3>{state.analysis?.title || `${area.label} process`}</h3>
    <p className="helper">{state.calculationSource === 'server'
      ? `Server-verified arithmetic · rules ${estimatorBank.version}. Quote and business terms still require AOC confirmation.`
      : 'Local preview only · server verification is required before relying on these calculations.'}</p>
    <div className="metric-title">{monthlyProgram ? 'Monthly build program' : 'Indicative one-time build'}</div>
    <div className="money">{monthlyProgram ? result.planFee === null ? 'Choose a program' : `${money(result.planFee)} / month` : reviewedMoney(result.build)}</div>
    <p>{monthlyProgram
      ? 'Agreed assessment, builds and implementation support use the accepted combined human-hour allowance. No additional upfront fee for included builds.'
      : result.buildQuoted ? 'Total from the entered project quote. AOC must confirm the amounts and scope.'
        : result.build !== null ? `Provisional planning range ${money(result.low)}–${money(result.high)}. Existing draft coefficients are not an approved fixed quote.`
          : 'Complete the material scope details or request AOC review. Known components are not a complete quote.'}</p>
    <Metric title="Paid initial audit" value={reviewedMoney(result.audit)} note="AOC quotes its scope and fixed fee upfront for either implementation route. No build-percentage fee is assumed." />
    <Metric title="Eligible audit credit" value={reviewedMoney(result.credit.amount)} note={`${result.credit.reason}${result.credit.expiryDate ? ` Calendar-date deadline: ${result.credit.expiryDate}.` : ''} This calculator does not redeem a credit.`} />
    {result.route === 'project' && <details>
      <summary>Fixed-project quote and payment illustration</summary>
      <Metric title="Preparation / foundation" value={reviewedMoney(state.answers.preparation_fee)} />
      <Metric title="Implementation including agreed reusable training" value={reviewedMoney(state.answers.implementation_fee)} />
      <Metric title="Additional purchased live training" value={state.answers.live_training === 'no' ? '$0' : reviewedMoney(state.answers.live_training_fee)} />
      <Metric title="Project balance after eligible credit" value={reviewedMoney(result.projectBalance)} />
      <Metric title="First project payment (50%)" value={reviewedMoney(result.firstProjectPayment)} />
      <Metric title="Second project payment (remaining 50%)" value={reviewedMoney(result.secondProjectPayment)} note="Project-only illustration. AOC agrees the due date; early completion does not accelerate it. No invoice or payment is created here." />
    </details>}
    {monthlyProgram && <>
      <Metric title="Agreed combined human hours" value={result.agreedMonthlyHours === null ? 'Needs AOC agreement' : `${result.agreedMonthlyHours} hours / month`} />
      <Metric title="Agreed agency blend" value={result.agreedAgencyBlend === null ? 'Needs AOC agreement' : `${money(result.agreedAgencyBlend)} / hour`} note="One agreed client blend; founder direction and review are included. Actual staffing changes do not silently change accepted billing." />
      <Metric title="First monthly invoice after eligible audit credit" value={reviewedMoney(result.monthlyInvoiceAfterCredit)} note="Illustration only; AOC must confirm invoice handling. Credit is not extra hours, and a route change cannot create a second credit." />
    </>}
    <Metric title="Estimated delivery" value={smallerBillingWorkflow && !monthlyProgram ? 'Approximately 2–4 weeks' : 'Schedule needs scope review'} note="Starts after required access, approved information and scope are ready. No guaranteed monthly deliverable count or completion date." />
    <Metric title="AOC monthly service" value={monthlyProgram ? result.planFee === null ? 'Select a program first' : 'Included in the program fee' : result.monthly === null ? 'Needs scope / quoted fee' : `${money(result.monthly)}${result.monthly === 0 ? '' : ' / month'}`} note={monthlyProgram
      ? 'The program fee above includes agreed implementation support; this is the same fee, not a second charge. Post-build maintenance is deferred.'
      : result.monthly === 0 ? 'Client-operated. Ad hoc help: $150/hour, $150 minimum per ticket, subject to availability.'
        : 'Optional project operation/support uses approved AOC pricing data only. Standard, Priority and Premier do not have automatic approved prices or staffed-response promises.'} />
    {(result.monthly > 0 || state.answers.management === 'yes') && <details><summary>AOC monthly service scope</summary><p>{monthlyProgram ? 'Agreed assessment, implementation and support within accepted program hours.' : 'Operating scope, coverage and its fee require AOC agreement; no price or response target is implied.'} Software and usage remain separate. Shared work and oversight are counted once.</p></details>}
    {state.answers.existing_client === 'yes' && <Metric title="Combined AOC monthly commitment" value={reviewedMoney(result.combinedMonthlyCommitment)} note="Confirmed retained existing agreement fee plus the new AOC monthly fee. No automatic plan replacement or overlapping work is assumed. This reconciliation does not add a second savings credit." />}
    <Metric title="Added software / usage" value={result.vendor === null ? 'To be validated' : `${money(result.vendor)} / month`} note="Separate from AOC fees. Unknown costs prevent complete net ROI." />
    {!monthlyProgram && <details>
      <summary>Build breakdown and assumptions</summary>
      <p>Retained provisional scope model only—not additional subscription charges or an approved quote.</p>
      {result.lines.map(line => <div className="line" key={line.label}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>)}
      <p>Known draft components: {money(result.known)}. Uncalibrated additions require review.</p>
      {result.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}
    </details>}
    <h3>Potential monthly value</h3>
    <Metric title="Team capacity freed" value={hours(result.freed)} note={`80% workflow planning illustration; ${hours(result.retained)} remains for checking and exceptions. Subject to audit, not a savings guarantee.`} />
    <Metric title="Capacity value" value={money(result.capacity)} note="Time available for other work—not automatic cash or payroll savings." />
    <Metric title="Recurring cash savings" value={money(result.cash)} note="Only provider fees and app costs actually eliminated for comparable work; counted once." />
    <Metric title="Total monthly ongoing costs" value={money(result.recurring)} note="New AOC monthly fee plus incremental software/usage. Existing agreement reconciliation is shown separately." />
    <Metric title="Net monthly economic benefit" value={money(result.net)} note="Capacity and confirmed cash savings less ongoing costs. Unknown material inputs or unreconciled existing scope prevent a supported result." />
    <details>
      <summary>{monthlyProgram ? 'Monthly-program value comparison' : 'First year and payback'}</summary>
      <p>{monthlyProgram ? 'Compare the same roadmap, accepted milestones and operating period. Included audit/build work is not charged twice.' : 'One-time spend includes the fixed audit plus project total, minus the eligible audit credit once. No assumed credit when eligibility is unknown.'}</p>
      <Metric title="Comparison period" value={result.comparisonMonths === null ? 'Choose comparison months' : `${result.comparisonMonths} ${monthlyProgram ? 'program' : 'operating'} months`} />
      {monthlyProgram && <Metric title="Months with operating benefits" value={result.benefitMonths === null ? 'Timing needs review' : `${result.benefitMonths} months within that period`} note="Program costs cover the whole chosen period; benefits are not assumed during implementation." />}
      <Metric title={monthlyProgram ? 'Total investment over selected period' : 'First-year investment'} value={reviewedMoney(result.comparisonInvestment)} />
      <Metric title="Gross economic benefit over that period" value={money(result.comparisonGross)} />
      <Metric title="Net economic benefit over that period" value={money(result.comparisonNet)} />
      {!monthlyProgram && <Metric title="Illustrative payback" value={result.payback !== null ? `${result.payback.toFixed(1)} months` : result.net !== null && result.net <= 0 ? 'No payback under these assumptions' : 'Incomplete inputs'} note="From operation; no supported payback until quote, audit/credit treatment and material costs are known." />}
    </details>
    {attention.length > 0 && <div className="warning"><strong>What still needs attention</strong><ul>{attention.map(item => <li key={item}>{item}</li>)}</ul></div>}
    <details open>
      <summary>Recommended solution and connected scope</summary>
      <p><strong>{state.answers.solution === 'agent' ? 'AI agent' : 'Automated workflow'}</strong></p>
      {state.routes.length ? <><p>Connected responsibilities included for review:</p><ul>{state.routes.map(route => <li key={route}>{route}</li>)}</ul></> : <p>No detailed responsibility selected yet; the description remains the scope starting point.</p>}
      <p><strong>Included:</strong> reviewed connected scope, agreed app touchpoints, testing, rollout, reusable training and handover. Shared work is counted once.</p>
      <p><strong>Excluded unless separately accepted:</strong> unrelated outcomes, material expansion, additional live training, unsupported integrations and third-party subscriptions or usage.</p>
    </details>
    <details open>
      <summary>Scope, readiness and next step</summary>
      <p><strong>{result.feasibility}</strong></p>
      {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
      <p>{result.commercialNotice}</p>
      <p>You provide business rules, required access and timely reviews. AOC checks blockers before recommending paid discovery. Download this review and send it to your AOC contact. No audit purchase is enabled in this test version.</p>
    </details>
    <button type="button" onClick={() => downloadSummary(state, area)}>Download estimate summary</button>
  </>;
}

export function EstimateSidebar({ state, area }) {
  const status = !state.result ? 'NOT CALCULATED' : state.dirty ? 'CHANGED · RECALCULATE'
    : state.calculationSource === 'local-preview' ? 'LOCAL PREVIEW · VERIFY'
      : !state.result.commercialReady ? 'SERVER VERIFIED · PARTIAL' : 'SERVER VERIFIED';
  return <aside><div className="estimate-card"><div className="eyebrow">YOUR ESTIMATE</div><div id="estimateStatus" className="status">{status}</div><div id="result"><Result state={state} area={area} /></div></div>
    <p className="aside-note">One connected system can include several tasks. More tasks do not automatically mean another agent or full build fee.</p></aside>;
}
