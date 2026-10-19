import { hours, money, normalizeAnswers } from '../lib/format.js';
import { estimatorBank } from '../lib/domain.js';

function Metric({ title, value, note = '' }) {
  return (
    <div className="metric">
      <div className="metric-title">{title}</div>
      <div className="value">{value}</div>
      {note && <p>{note}</p>}
    </div>
  );
}

function downloadSummary(state, area) {
  const report = {
    version: estimatorBank.version,
    description: state.description,
    area: area.label,
    scope: normalizeAnswers(state.answers),
    routes: state.routes,
    result: state.result,
    calculationSource: state.calculationSource,
    notice: 'Draft estimate only; monetary coefficients and SLAs not finalized.',
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aoc-estimate-review.json';
  link.click();
  URL.revokeObjectURL(url);
}

function Result({ state, area }) {
  const result = state.result;
  if (!result) {
    return (
      <>
        <h2>A clear picture,<br />one process at a time.</h2>
        <p>Your estimate appears here after you review the details and calculate.</p>
        <div className="empty-stat">Build + audit</div>
        <div className="empty-stat">Optional monthly service</div>
        <div className="empty-stat">Time and potential value</div>
      </>
    );
  }

  const attention = [...result.errors, ...result.pending];
  const solutionLabel = state.answers.solution === 'agent' ? 'AI agent' : 'Automated workflow';
  const smallerBillingWorkflow = area.id === 'area0'
    && state.answers.solution === 'workflow'
    && ['simple', 'moderate'].includes(result.level);
  return (
    <>
      <h3>{state.analysis?.title || `${area.label} process`}</h3>
      <p className="helper">
        {state.calculationSource === 'server'
          ? `Server-verified calculation · rules ${estimatorBank.version}`
          : 'Local preview only · server verification is required before relying on this estimate.'}
      </p>
      <div className="metric-title">Indicative one-time build</div>
      <div className="money">{money(result.build)}</div>
      {result.build !== null ? (
        <p>Planning range {money(result.low)}–{money(result.high)}. Draft calibration, subject to audit.</p>
      ) : (
        <p>Complete the material scope details or request AOC review. Known components below are not a complete quote.</p>
      )}
      <Metric title="Paid validation audit" value={money(result.audit)} note="10% of the estimated build. Full eligible credit toward the build when you proceed and pay within 30 days of findings/proposal. Counted once, not added twice." />
      <Metric
        title="Estimated delivery"
        value={smallerBillingWorkflow ? 'Approximately 2–4 weeks' : 'Schedule needs scope review'}
        note="Starts after required access, approved information and scope are ready. Estimate only."
      />
      <Metric
        title="AOC monthly service"
        value={result.monthly === null ? 'Needs scope / coverage selection' : `${money(result.monthly)}${result.monthly === 0 ? '' : ' / month'}`}
        note={result.monthly > 0
          ? 'Draft test fee; one fee includes upkeep, agreed expert oversight and chosen coverage. Not approved for client sale.'
          : result.monthly === 0
            ? 'Self-managed; ad hoc help $150/hour, $150 minimum per ticket.'
            : 'Optional for technical support; managed production must have a defined recurring scope.'}
      />
      <Metric title="Added software / usage" value={result.vendor === null ? 'To be validated' : `${money(result.vendor)} / month`} note="Separate from AOC’s service fee. Unknown costs prevent complete net ROI." />

      <details>
        <summary>Build breakdown and assumptions</summary>
        {result.lines.map((line) => (
          <div className="line" key={line.label}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
        ))}
        <p>Known components: {money(result.known)}{result.build === null ? ' · not a complete estimate' : ''}.</p>
        {result.assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}
        <p>These draft coefficients are preserved from the pricing models. Detailed scope requiring an uncalibrated addition stays subject to review.</p>
      </details>

      <h3>Potential monthly value</h3>
      <Metric title="Team capacity freed" value={hours(result.freed)} note={`80% planning assumption; ${hours(result.retained)} remains for checking and exceptions.`} />
      <Metric title="Capacity value" value={money(result.capacity)} note="Time available for other work; not automatic cash or payroll savings." />
      <Metric title="Recurring cash savings" value={money(result.cash)} note="Only provider fees and app costs actually eliminated." />
      <Metric title="Total monthly ongoing costs" value={money(result.recurring)} note="AOC monthly service plus additional software / usage." />
      <Metric title="Net monthly economic benefit" value={money(result.net)} note="Includes capacity value and confirmed cash savings, less ongoing costs." />

      <details>
        <summary>First year and payback</summary>
        <Metric title="First-year investment" value={money(result.yearInvestment)} note="Build plus 12 operating months of ongoing costs; eligible audit credit counted once." />
        <Metric title="First-year gross economic benefit" value={money(result.yearGross)} />
        <Metric title="First-year net economic benefit" value={money(result.yearNet)} />
        <Metric
          title="Illustrative payback"
          value={result.payback !== null
            ? `${result.payback.toFixed(1)} months`
            : result.net !== null && result.net <= 0
              ? 'No payback under these assumptions'
              : 'Incomplete inputs'}
          note="From operation; not a guarantee."
        />
      </details>

      {attention.length > 0 && (
        <div className="warning">
          <strong>What still needs attention</strong>
          <ul>{attention.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      <details open>
        <summary>Recommended solution and connected scope</summary>
        <p><strong>{solutionLabel}</strong></p>
        {state.routes.length ? (
          <>
            <p>Connected responsibilities included for review:</p>
            <ul>{state.routes.map((route) => <li key={route}>{route}</li>)}</ul>
          </>
        ) : (
          <p>No detailed responsibility has been selected yet; the description remains the scope starting point.</p>
        )}
        <p><strong>Included:</strong> one connected outcome, its reviewed stages, agreed app touchpoints, testing, handover, and the responsibilities listed above.</p>
        <p><strong>Excluded unless separately scoped:</strong> unrelated outcomes, additional systems or business units, major redesigns, new authority or approval rules, historical data cleanup beyond the selected preparation level, and third-party subscriptions or usage fees.</p>
      </details>
      <details open>
        <summary>Scope, readiness and next step</summary>
        <p><strong>{result.feasibility}</strong></p>
        {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        <p>The estimate is not a final quote. AOC reviews known blockers before recommending a paid audit. Audit findings may change build scope and price.</p>
        <p>You provide an owner, approved business rules, required app access and timely reviews. We confirm responsibilities and requirements before work starts.</p>
        <p>Next step: download this review summary and send it to your AOC contact for scope review. No audit purchase is enabled in this testing preview.</p>
      </details>
      <button type="button" onClick={() => downloadSummary(state, area)}>Download estimate summary</button>
    </>
  );
}

export function EstimateSidebar({ state, area }) {
  const managedServiceIncomplete = state.answers.management === 'yes'
    && state.result?.monthly === null;
  const status = !state.result
    ? 'NOT CALCULATED'
    : state.dirty
      ? 'CHANGED · RECALCULATE'
      : state.calculationSource === 'local-preview'
        ? 'LOCAL PREVIEW · VERIFY'
      : state.result.build === null || managedServiceIncomplete
        ? 'PARTIAL · REVIEW NEEDED'
        : 'DRAFT ESTIMATE';

  return (
    <aside>
      <div className="estimate-card">
        <div className="eyebrow">YOUR ESTIMATE</div>
        <div id="estimateStatus" className="status">{status}</div>
        <div id="result"><Result state={state} area={area} /></div>
      </div>
      <p className="aside-note">
        One connected system can include several tasks. Selecting more tasks does not automatically
        mean another agent or another full build fee.
      </p>
    </aside>
  );
}
