import { hours, money, normalizeAnswers } from '../../lib/format.js';
import { estimatorBank } from '../../lib/domain.js';
import { describeEstimate } from '../../lib/estimate-display.js';
import { Icon } from '../../components/Icon.jsx';

function Metric({ title, value, note = '' }) {
  return <div className="metric"><div className="metric-title">{title}</div><div className="value">{value}</div>{note && <p>{note}</p>}</div>;
}
function ResultGroup({ title, icon, children }) {
  return <details className="result-group">
    <summary><span><Icon name={icon} />{title}</span></summary>
    <div className="result-group__body">{children}</div>
  </details>;
}
const reviewedMoney = (value, missing) => value == null ? missing : money(value);
const hasAmount = value => value != null && value !== '';
const feasibilityLabels = {
  'Potential blocker': 'AOC needs to check a possible issue before work can proceed',
  'Needs connection review': 'AOC needs to check what your apps can support',
  'Action-level verification still required': 'AOC will check what each app can do and what access it needs',
  'Needs verification': 'AOC needs to check the work and the apps involved',
};

function ProjectPayments({ answers, result }) {
  const missing = [];
  if (!hasAmount(answers.preparation_fee)) missing.push('the preparation fee');
  if (!hasAmount(answers.implementation_fee)) missing.push('the implementation fee');
  if (answers.live_training === 'yes' && !hasAmount(answers.live_training_fee)) missing.push('the live training fee');
  if (!['yes', 'no'].includes(answers.live_training)) missing.push('whether additional live training is included');

  let paymentNote = 'AOC needs to check the work and the amount before showing project payments.';
  if (result.errors.length) paymentNote = 'Correct the values listed under “What still needs to be checked” to see the project payments.';
  else if (!result.buildQuoted) paymentNote = result.credit.amount == null
    ? 'AOC needs the full quote and confirmation of any audit credit to show the project payment amounts.'
    : 'The project payment amounts will show once the full quote is available.';
  else if (result.build == null) paymentNote = 'The project quote is recorded. Confirm the work and app connections before relying on the payment amounts.';
  else if (result.credit.amount == null) paymentNote = 'The project quote is recorded. AOC still needs to confirm whether any audit fee can be credited toward the build before the payment amounts can be shown.';
  else if (result.credit.amount > result.build) paymentNote = 'The audit credit is larger than the project quote. AOC needs to confirm how it will be applied.';

  return <details>
    <summary>Project quote and payment amounts</summary>
    {!result.buildQuoted && <p>{missing.length
      ? `AOC still needs to confirm ${new Intl.ListFormat('en').format(missing)}. If you already have those details from AOC, you can add them in Responsibilities and service.`
      : 'AOC needs to confirm the full project quote.'}</p>}
    {hasAmount(answers.preparation_fee) && <Metric title="Preparation and setup" value={money(answers.preparation_fee)} />}
    {hasAmount(answers.implementation_fee) && <Metric title="Implementation, including agreed reusable training" value={money(answers.implementation_fee)} />}
    {answers.live_training === 'no' && <Metric title="Additional live training" value="Not included" />}
    {answers.live_training === 'yes' && hasAmount(answers.live_training_fee) && <Metric title="Additional live training" value={money(answers.live_training_fee)} />}
    {result.projectBalance == null ? <p>{paymentNote}</p> : <>
      <Metric title="Project balance after audit credit" value={money(result.projectBalance)} />
      <Metric title="First project payment (50%)" value={money(result.firstProjectPayment)} />
      <Metric title="Second project payment (remaining 50%)" value={money(result.secondProjectPayment)} note="These amounts show how the project balance would be split. AOC confirms the payment due date, which still applies if work finishes early." />
    </>}
  </details>;
}

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

function Result({ state, area, onNavigate }) {
  const result = state.result;
  if (!result) return <div className="result-empty">
    <div className="result-empty__icon"><Icon name="chart" /></div>
    <h2>Your estimate<br />starts here.</h2>
    <p>Complete the relevant details, then calculate to see costs and potential value.</p>
    <div className="empty-stat"><span>One-time build</span><strong>—</strong></div>
    <div className="empty-stat"><span>Monthly costs</span><strong>—</strong></div>
    <div className="empty-stat"><span>Potential value</span><strong>—</strong></div>
    <p className="result-empty__foot">Prices are in USD. AOC confirms the final scope and price.</p>
  </div>;
  const monthlyProgram = result.route === 'monthly';
  const attention = [...result.errors, ...result.pending];
  const display = describeEstimate(result, state.answers);
  const missingScope = result.build === null && result.provisionalBuild === null && !result.errors.length
    && !['Potential blocker', 'Needs connection review'].includes(result.feasibility);
  const aocDetails = [
    result.audit === null && 'the audit fee',
    result.route === 'project' && !result.buildQuoted && !display.paybackNote && 'the project quote',
    result.credit.amount === null && result.net == null && 'audit credit eligibility',
    display.agreementPending && 'changes to your existing agreement',
  ].filter(Boolean);
  const smallerBillingWorkflow = area.id === 'area0' && state.answers.solution === 'workflow' && ['simple', 'moderate'].includes(result.level);
  return <>
    {state.dirty && <p className="result-stale">Answers changed. Recalculate to update this estimate.</p>}
    <div className="result-hero">
    <h3>{state.analysis?.title || `${area.label} process`}</h3>
    <div className="metric-title">{monthlyProgram ? 'Monthly build program' : result.buildQuoted ? 'Project quote entered' : 'One-time build estimate'}</div>
    <div className="money">{monthlyProgram ? result.planFee === null ? 'Choose a program' : `${money(result.planFee)} / month` : reviewedMoney(result.build, missingScope ? 'Complete scope details' : 'Needs AOC review')}</div>
    <p>{monthlyProgram
      ? 'Agreed assessment, builds and implementation support use the accepted combined human-hour allowance. No additional upfront fee for included builds.'
      : result.buildQuoted ? result.build === null ? 'Your project quote is saved. Review the missing scope or app details to show the total.' : 'Based on the project quote you entered. AOC will confirm the scope and price.'
        : result.build !== null ? `Estimated range: ${money(result.low)}–${money(result.high)}. Agree the final scope and price with AOC.`
          : 'Some scope or app details still need checking. The items below do not yet make a complete quote.'}</p>
    </div>
    <dl className="result-cost-summary">
      <div><dt>Initial audit fee <small>15% of project</small></dt><dd>{reviewedMoney(result.audit, 'Complete the project estimate')}</dd></div>
      <div><dt>New ongoing costs <small>/ month</small></dt><dd>{display.ongoing}</dd></div>
    </dl>
    {(result.net != null || display.payback || (monthlyProgram && result.comparisonMonths != null)) && <div className="result-highlights">
      {result.net != null && <div className="result-highlight">
        <span>Estimated monthly value after costs</span>
        <strong>{money(result.net)}</strong>
        <small>Includes the value of time saved. Actual cost savings are shown separately.</small>
      </div>}
      {(display.payback || (monthlyProgram && result.comparisonMonths != null)) && <div className="result-highlight">
        <span>{monthlyProgram ? 'Comparison period' : 'Illustrative payback'}</span>
        <strong>{monthlyProgram ? `${result.comparisonMonths} months` : display.payback}</strong>
        {result.payback != null && <small>Estimated time to recover your upfront costs.</small>}
      </div>}
    </div>}
    {(missingScope || display.roiNote || display.paybackNote || aocDetails.length > 0) && <section className="result-incomplete" aria-labelledby="result-next-steps">
      <h4 id="result-next-steps">What affects the remaining figures</h4>
      {missingScope && <div>
        <p><strong>Complete the scope:</strong> review the missing process or app details listed below.</p>
        <button type="button" className="result-edit" onClick={() => onNavigate(3)}>Review process & scope <Icon name="chevron" /></button>
      </div>}
      {display.roiNote && <p>{display.roiNote}</p>}
      {display.optionalValueInputsMissing && <button type="button" className="result-edit" onClick={() => onNavigate(6)}>Review time & costs <Icon name="chevron" /></button>}
      {display.paybackNote && <p>{display.paybackNote}</p>}
      {aocDetails.length > 0 && <p><strong>AOC will confirm</strong> {aocDetails.join(', ')}.</p>}
    </section>}
    <ResultGroup title="Project & ongoing costs" icon="layers">
    <Metric title="Initial audit fee" value={reviewedMoney(result.audit, 'Complete the project estimate')} note="Calculated as 15% of the complete one-time project estimate. Monthly services and client-paid third-party costs are separate." />
    <Metric title="Audit credit toward the build" value={reviewedMoney(result.credit.amount, 'AOC will confirm whether a credit applies')} note={`${result.credit.reason}${result.credit.expiryDate ? ` Credit deadline ${result.credit.expiryDate}.` : ''}`} />
    {result.route === 'project' && <ProjectPayments answers={state.answers} result={result} />}
    {monthlyProgram && <>
      <Metric title="Agreed combined human hours" value={result.agreedMonthlyHours === null ? 'Needs AOC agreement' : `${result.agreedMonthlyHours} hours / month`} />
      <Metric title="Agreed agency blend" value={result.agreedAgencyBlend === null ? 'Needs AOC agreement' : `${money(result.agreedAgencyBlend)} / hour`} note="One agreed client blend; founder direction and review are included. Actual staffing changes do not silently change accepted billing." />
      <Metric title="First monthly invoice after audit credit" value={reviewedMoney(result.monthlyInvoiceAfterCredit, 'AOC will confirm the monthly fee and any credit')} note="AOC confirms how the credit applies to the first invoice. The same credit can be used once across both routes." />
    </>}
    <Metric title="Estimated build timeline" value={smallerBillingWorkflow && !monthlyProgram ? 'Approximately 2–4 weeks' : 'AOC will confirm after reviewing the work'} note="Timing starts once AOC has agreed the work with you and has the information and access it needs." />
    <Metric title="AOC monthly service" value={display.support} note={monthlyProgram
      ? 'The program fee above includes agreed implementation support; this is the same fee, not a second charge. Post-build maintenance is deferred.'
      : display.supportNotIncluded ? 'Ad hoc help: $150/hour, $150 minimum per ticket, subject to availability.'
        : 'AOC agrees the scope and coverage separately.'} />
    {(result.monthly > 0 || display.requestedSupport) && <details><summary>What monthly support would cover</summary><p>{monthlyProgram ? 'The program covers the agreed assessment, implementation and support within the agreed hours.' : 'AOC will confirm the work covered, support hours, response targets and monthly fee with you.'} Software and usage are priced separately. Shared work and oversight are counted once.</p></details>}
    {state.answers.existing_client === 'yes' && <Metric title="Total AOC monthly fees" value={reviewedMoney(result.combinedMonthlyCommitment, 'AOC will confirm the existing and new fees')} note="This total adds the part of your current agreement you keep and the new AOC monthly fee. AOC checks for overlapping work." />}
    <Metric title="Added software / usage" value={result.vendor === null ? 'Software costs not provided' : `${money(result.vendor)} / month`} note="Separate from AOC fees. Add known costs in Section 6 to include them in the estimate." />
    </ResultGroup>
    {!monthlyProgram && <details className="result-group">
      <summary><span><Icon name="finance" />How the build estimate was calculated</span></summary>
      <div className="result-group__body">
      <p>These items add up to the calculator’s estimate. AOC provides the final project quote separately.</p>
      {result.lines.map(line => <div className="line" key={line.label}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>)}
      <p>Subtotal of the items above: {money(result.known)}. AOC will review any work still needing a price.</p>
      {result.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}
      </div>
    </details>}
    <ResultGroup title="Potential monthly value" icon="chart">
    {result.freed != null && <Metric title="Team capacity freed" value={hours(result.freed)} note={`80% workflow planning illustration. ${hours(result.retained)} remains for checking and exceptions. Subject to audit.`} />}
    {result.capacity != null && <Metric title="Capacity value" value={money(result.capacity)} note="The value of time available for other work. This may not reduce payroll costs." />}
    {result.cash != null && <Metric title="Recurring cash savings" value={money(result.cash)} note="Includes confirmed provider fees and app costs that would be eliminated for comparable work." />}
    {result.recurring != null && <Metric title="Total monthly ongoing costs" value={money(result.recurring)} note="New AOC monthly fee plus added software and usage. Any changes to an existing agreement are shown separately." />}
    {result.net != null && <Metric title="Net monthly economic benefit" value={money(result.net)} note="The value of time saved and costs removed, minus new monthly costs." />}
    {[result.freed, result.capacity, result.cash, result.recurring, result.net].every(value => value == null) && <p>Add time and cost details to see a potential value breakdown.</p>}
    {([result.comparisonInvestment, result.comparisonGross, result.comparisonNet].some(value => value != null) || display.payback) && <details>
      <summary>{monthlyProgram ? 'Monthly-program value comparison' : 'First year and payback'}</summary>
      <p>{monthlyProgram ? 'Compare the same roadmap, accepted milestones and operating period. Included audit/build work is not charged twice.' : 'One-time spend includes the 15% audit fee plus the project total, minus an eligible audit credit once. No credit is assumed when eligibility is unknown.'}</p>
      <Metric title="Comparison period" value={result.comparisonMonths === null ? 'Choose comparison months' : `${result.comparisonMonths} ${monthlyProgram ? 'program' : 'operating'} months`} />
      {monthlyProgram && <Metric title="Months with operating benefits" value={result.benefitMonths === null ? 'Timing needs review' : `${result.benefitMonths} months within that period`} note="Program costs cover the whole chosen period; benefits are not assumed during implementation." />}
      {result.comparisonInvestment != null && <Metric title={monthlyProgram ? 'Total investment over selected period' : 'First-year investment'} value={money(result.comparisonInvestment)} />}
      {result.comparisonGross != null && <Metric title="Gross economic benefit over that period" value={money(result.comparisonGross)} />}
      {result.comparisonNet != null && <Metric title="Net economic benefit over that period" value={money(result.comparisonNet)} />}
    </details>}
    </ResultGroup>
    {attention.length > 0 && <details className="result-group result-review" open={result.errors.length > 0}>
      <summary><span>What still needs to be checked <b className="result-review__count">({attention.length})</b></span></summary>
      <div className="result-group__body"><ul>{attention.map(item => <li key={item}>{item}</li>)}</ul></div>
    </details>}
    <details className="result-group">
      <summary><span><Icon name="operations" />What the project would cover</span></summary>
      <div className="result-group__body">
      <p><strong>{state.answers.solution === 'agent' ? 'AI agent' : 'Automated workflow'}</strong></p>
      {state.routes.length ? <><p>Work included for review:</p><ul>{state.routes.map(route => <li key={route}>{route}</li>)}</ul></> : <p>Start with your work description, then confirm the tasks to include.</p>}
      <p><strong>Included:</strong> the agreed work and app connections, testing, launch, reusable training and handover. Shared work is counted once.</p>
      <p><strong>Excluded unless separately accepted:</strong> unrelated outcomes, material expansion, additional live training, unsupported integrations and third-party subscriptions or usage.</p>
      </div>
    </details>
    <details className="result-group">
      <summary><span><Icon name="clock" />What happens next</span></summary>
      <div className="result-group__body">
      <p><strong>{feasibilityLabels[result.feasibility] || result.feasibility}.</strong></p>
      {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
      <p>{result.commercialNotice}</p>
      <p>If Make is needed, you own its account and billing and pay Make directly for subscriptions and usage. AOC receives authorized access for the agreed work and does not rebill Make credits.</p>
      <p>If you want to proceed, share this estimate with AOC. AOC checks whether the work is feasible before offering a paid audit. You and AOC then agree what the work includes, the access needed and any remaining prices.</p>
      </div>
    </details>
  </>;
}

export function EstimateSidebar({ state, area, onNavigate }) {
  const status = !state.result ? 'NOT CALCULATED' : state.dirty ? 'CHANGED · RECALCULATE'
    : state.calculationSource === 'local-preview' ? 'LOCAL PREVIEW · VERIFY'
      : !state.result.commercialReady ? 'CALCULATED · PARTIAL' : 'ESTIMATE CALCULATED';
  return <aside id="estimate" className="estimate-aside" aria-label="Your estimate">
    <div className={`estimate-card${state.result && state.dirty ? ' is-stale' : ''}`}>
      <div className="estimate-card__header">
        <div className="eyebrow">YOUR ESTIMATE</div>
        <div id="estimateStatus" className="status" role="status">{status}</div>
      </div>
      <div id="result" className="result-scroll"><Result state={state} area={area} onNavigate={onNavigate} /></div>
      {state.result && <div className="estimate-card__footer">
        <button type="button" className="result-download" onClick={() => downloadSummary(state, area)}><Icon name="download" />Download estimate summary</button>
        <p className="result-verification">{state.calculationSource === 'server'
          ? 'Calculated from your answers. Confirm the final scope and prices with AOC.'
          : 'This is a local estimate. Ask AOC to verify the figures before relying on them.'}</p>
      </div>}
    </div>
    <p className="aside-note">One connected system can include several tasks. More tasks do not automatically mean another agent or full build fee.</p>
  </aside>;
}
