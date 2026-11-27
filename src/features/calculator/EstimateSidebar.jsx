import { hours, money, normalizeAnswers } from '../../lib/format.js';
import { estimatorBank, simplifiedRules } from '../../lib/domain.js';
import { Icon } from '../../components/Icon.jsx';

function Metric({ title, value, note = '' }) {
  return <div className="metric">
    <div className="metric-title">{title}</div>
    <div className="value">{value}</div>
    {note && <p>{note}</p>}
  </div>;
}

function ResultGroup({ title, icon, children }) {
  return <details className="result-group">
    <summary><span><Icon name={icon} />{title}</span></summary>
    <div className="result-group__body">{children}</div>
  </details>;
}

function downloadSummary(state, area) {
  const scope = normalizeAnswers(state.answers);
  for (const key of [
    'management', 'tier', 'existing_client', 'implementation_route', 'current_audit_credit',
    'purchased_training', 'support_choice', 'preparation_fee', 'implementation_fee',
    'live_training', 'live_training_fee',
  ]) delete scope[key];
  const report = {
    version: simplifiedRules.version,
    description: state.description,
    area: area.label,
    scope,
    result: state.result,
    calculationSource: state.calculationSource,
    notice: state.result.commercialNotice,
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
  if (!result) return <div className="result-empty">
    <div className="result-empty__icon"><Icon name="chart" /></div>
    <h2>Your estimate<br />starts here.</h2>
    <p>Complete the details you know, confirm the process, and calculate your preliminary estimate.</p>
    <div className="empty-stat"><span>One-time build range</span><strong>—</strong></div>
    <div className="empty-stat"><span>Paid planning fee</span><strong>—</strong></div>
    <div className="empty-stat"><span>Monthly capacity value</span><strong>—</strong></div>
    <p className="result-empty__foot">Planning figures only. AOC confirms scope, feasibility, and final prices.</p>
  </div>;

  const attention = [...result.errors, ...result.pending];
  const buildRange = result.build === null
    ? 'Needs details'
    : `${money(result.low)}–${money(result.high)}`;
  const makeBudget = result.makeBudget
    ? `${money(result.makeBudget.low)}–${money(result.makeBudget.high)} / month`
    : 'Needs workload details';
  const roiAvailable = result.baselineMonthlyBenefit !== null;

  return <>
    {state.dirty && <p className="result-stale">Answers changed. Recalculate to update this estimate.</p>}
    <div className="result-hero">
      <h3>{state.analysis?.title || `${area.label} process`}</h3>
      <div className="metric-title">Preliminary one-time build range</div>
      <div className="money">{buildRange}</div>
      <p>{state.analysis?.summary || 'A fixed-price planning estimate based on the scope and assumptions below.'} The final scope and price are confirmed by AOC.</p>
    </div>
    <dl className="result-cost-summary">
      <div>
        <dt>Discovery & Implementation Plan fee <small>15% of estimate</small></dt>
        <dd>{result.audit === null ? 'Needs build estimate' : money(result.audit)}</dd>
      </div>
      <div>
        <dt>Potential fee credit <small>conditional; applied once</small></dt>
        <dd>{result.credit.potentialAmount === null ? 'Not calculated' : money(result.credit.potentialAmount)}</dd>
      </div>
    </dl>
    {roiAvailable && <div className="result-highlights">
      <div className="result-highlight">
        <span>Illustrative monthly baseline value</span>
        <strong>{money(result.baselineMonthlyBenefit)}</strong>
        <small>Includes capacity value and only confirmed eliminated costs; not a guaranteed cash saving.</small>
      </div>
      <div className="result-highlight">
        <span>Illustrative payback</span>
        <strong>{result.payback === null ? 'Not estimated' : `${result.payback.toFixed(1)} months`}</strong>
        <small>Uses the build midpoint and baseline monthly value; excludes the separate paid-plan fee and any conditional credit.</small>
      </div>
    </div>}
    {attention.length > 0 && <section className="result-incomplete" aria-labelledby="result-next-steps">
      <h4 id="result-next-steps">What still needs to be checked</h4>
      {result.errors.length > 0 && <ul>{result.errors.map(item => <li key={item}>{item}</li>)}</ul>}
      {result.pending.length > 0 && <ul>{result.pending.map(item => <li key={item}>{item}</li>)}</ul>}
    </section>}

    <ResultGroup title="One-time build estimate" icon="finance">
      <p>The estimate uses the approved fixed-price components below. The range is for planning and is not a quote.</p>
      {result.lines.map(line => (
        <div className="line" key={line.label}>
          <span>{line.label}{line.status && <small> — {line.status}</small>}</span>
          <strong>{money(line.amount)}</strong>
        </div>
      ))}
      <Metric
        title={result.build === null ? 'Known subtotal so far' : 'Estimated build midpoint'}
        value={money(result.known)}
        note={result.build === null
          ? 'This is not a complete estimate until the required pricing details are confirmed.'
          : `Planning range: ${money(result.low)}–${money(result.high)}.`}
      />
      {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
      {result.assumptions.map(assumption => <p key={assumption}>{assumption}</p>)}
    </ResultGroup>

    <ResultGroup title="Baseline ROI illustration" icon="chart">
      <Metric title="Monthly team time" value={state.answers.team_time ? hours(Number(state.answers.team_time)) : 'Not provided'} />
      <Metric title="Approximate internal hourly cost" value={state.answers.blended_hourly_cost ? money(Number(state.answers.blended_hourly_cost)) : 'Not provided'} />
      <Metric title="Potential capacity freed" value={result.freed === null ? 'Needs inputs' : hours(result.freed)} note="An 80/20 planning illustration: 80% freed capacity and 20% retained for review and exceptions." />
      <Metric title="Monthly capacity value" value={result.capacity === null ? 'Needs inputs' : money(result.capacity)} note="Value of time available for other work; not necessarily a payroll reduction." />
      <Metric
        title="Confirmed monthly cash savings"
        value={result.cash === null ? 'Not included' : money(result.cash)}
        note={result.cash === null
          ? 'Unknown or unconfirmed provider and software savings are not counted.'
          : 'Only explicitly confirmed costs that will be eliminated are counted.'}
      />
      {result.yearNet !== null && <Metric title="Illustrative first-year net value" value={money(result.yearNet)} note="Uses the build estimate only; excludes the separate paid-plan fee and any conditional credit." />}
      {result.yearRoi !== null && <Metric title="Illustrative first-year return" value={`${result.yearRoi.toFixed(1)}%`} note="Uses the build estimate only; excludes the separate paid-plan fee and any conditional credit." />}
      <p>The baseline excludes future operating costs and any unconfirmed savings. Actual outcomes depend on validated workflow and workload.</p>
    </ResultGroup>

    <ResultGroup title="Possible Make usage budget" icon="layers">
      <Metric title="Illustrative external usage budget" value={makeBudget} note={`${result.usage?.lowCredits ?? '—'}–${result.usage?.highCredits ?? '—'} Make credits per month under the stated assumptions.`} />
      <p>{simplifiedRules.notices.usage}</p>
      <p>This possible external usage cost is separate from the build estimate and ROI calculation.</p>
    </ResultGroup>

    <ResultGroup title="What happens next" icon="clock">
      <p><strong>{simplifiedRules.freeServiceName}</strong> is a planning estimate, not a feasibility check or final quote.</p>
      <p>If you proceed, the <strong>{simplifiedRules.paidServiceName}</strong> checks the workflow, apps, data, and requirements and prepares an implementation plan and fixed-price proposal. AOC confirms whether any fee credit applies.</p>
      <p>{simplifiedRules.notices.estimate}</p>
      <p>{simplifiedRules.notices.launchSupport}</p>
    </ResultGroup>
  </>;
}

export function EstimateSidebar({ state, area }) {
  const status = !state.result ? 'NOT CALCULATED' : state.dirty ? 'CHANGED · RECALCULATE'
    : state.calculationSource === 'local-preview' ? 'LOCAL PREVIEW · VERIFY'
      : !state.result.commercialReady ? 'CALCULATED · PARTIAL' : 'ESTIMATE CALCULATED';
  return <aside id="estimate" className="estimate-aside" aria-label="Your estimate">
    <div className={`estimate-card${state.result && state.dirty ? ' is-stale' : ''}`}>
      <div className="estimate-card__header">
        <div className="eyebrow">YOUR ESTIMATE</div>
        <div id="estimateStatus" className="status" role="status">{status}</div>
      </div>
      <div id="result" className="result-scroll"><Result state={state} area={area} /></div>
      {state.result && <div className="estimate-card__footer">
        <button type="button" className="result-download" onClick={() => downloadSummary(state, area)}>
          <Icon name="download" />Download estimate summary
        </button>
        <p className="result-verification">{state.calculationSource === 'server'
          ? 'Calculated from your answers. Confirm the final scope and prices with AOC.'
          : 'This is a local estimate. Ask AOC to verify the figures before relying on them.'}</p>
      </div>}
    </div>
    <p className="aside-note">Planning estimates only. Unknown savings and future operating costs are not counted.</p>
  </aside>;
}
