import { estimatorBank } from '../../lib/domain.js';
import { marketingAreas } from '../../constants.js';
import { MarketingFields } from './MarketingFields.jsx';
import { QuestionBank } from './QuestionBank.jsx';

export function ScopeSection({ state, area, fields, onToggleRoute, onAddField }) {
  const sharedIds = new Set([
    ...estimatorBank.appFields,
    ...estimatorBank.dataFields,
    ...estimatorBank.roiFields,
    ...estimatorBank.serviceFields,
  ].map((field) => field.id));
  const candidates = area.fields.filter((field) => field.id !== 'generic' && !sharedIds.has(field.id));
  const chosen = candidates.filter((field) => state.visible.includes(field.id));
  const allRoutes = [...new Set(area.fields.map((field) => field.route))]
    .filter((route) => route && !/Shared oversight/i.test(route));
  const displayedRoutes = allRoutes.filter((route, index) =>
    state.routes.length ? state.routes.includes(route) : index < 6,
  );
  const hasAnswer = (id) =>
    state.answers[id] !== null && state.answers[id] !== undefined && state.answers[id] !== '';
  const complexityIds = [
    'steps_band',
    'variation_band',
    ...(state.answers.solution === 'agent' ? ['decision_band'] : []),
  ];
  const rolloutIds = [
    'people_count',
    'department_count',
    'cadence',
    'handover',
  ];
  const marketingIds = marketingAreas.has(state.area) ? [
    'capability_count',
    'brand_count',
    'language_count',
    'delivery_mode',
    ...(state.area === 'area7' ? ['channel_count', 'format_count'] : []),
    ...(state.area === 'area8' ? ['initial_pages', 'keyword_count', 'market_count'] : []),
    ...(state.answers.delivery_mode === 'managed'
      ? state.area === 'area8'
        ? ['monthly_pages', 'monthly_articles']
        : ['monthly_outputs']
      : []),
  ] : [];
  const answeredCount = (ids) => ids.filter(hasAnswer).length;
  const progress = (ids) => `${answeredCount(ids)} of ${ids.length}`;

  return (
    <>
      <h2>Review the connected process.</h2>
      <p>We organize the work into one scope. Correct anything that’s missing or inaccurate.</p>
      {state.analysis ? (
        <div className="subtle">
          <strong>{state.analysis.title}</strong>
          <p>{state.analysis.summary}</p>
          <span className="proposed">
            Recommended solution: {state.analysis.solution}. {state.analysis.recommendationReason}
          </span>
        </div>
      ) : (
        <div className="subtle">
          No AI analysis yet. You can still enter the main facts below and choose relevant details.
        </div>
      )}
      {fields.select('solution', 'Recommended starting solution', [
        ['workflow', 'Automated workflow'],
        ['agent', 'AI agent'],
      ], 'A recommendation for this connected process; subject to review.')}

      <details
        className="optional-section required-section estimate-details"
        name="estimate-essentials"
        defaultOpen={answeredCount(complexityIds) < complexityIds.length}
      >
        <summary>
          <span>1. Process complexity</span>
          <span className="disclosure-meta">{progress(complexityIds)} required</span>
        </summary>
        <p className="helper">These answers set the base build band. Approximate answers are enough.</p>
        {state.analysis?.classification?.reason && (
          <p className="proposed">Proposed classification: {state.analysis.classification.reason}</p>
        )}
        {fields.select('steps_band', 'How many stages and handoffs are involved?', [
          [1, 'One straightforward sequence'],
          [2, 'Several stages or handoffs'],
          [3, 'Connected stages across systems'],
          [4, 'Extensive custom process'],
        ])}
        {fields.select('variation_band', 'How much do the rules vary?', [
          [1, 'The same rules throughout'],
          [2, 'A few standard groups'],
          [3, 'Many customer-specific rules'],
          [4, 'Interacting custom rules across operations'],
        ])}
        {state.answers.solution === 'agent' && fields.select('decision_band', 'What decisions should AI help with?', [
          [1, 'Classify information or prepare drafts'],
          [2, 'Several bounded decisions'],
          [3, 'Multiple decisions using tools and knowledge'],
          [4, 'Plan across systems'],
        ])}
      </details>
      <details
        className="optional-section required-section estimate-details"
        name="estimate-essentials"
        defaultOpen={
          answeredCount(complexityIds) === complexityIds.length
          && answeredCount(rolloutIds) < rolloutIds.length
        }
      >
        <summary>
          <span>2. Team and rollout</span>
          <span className="disclosure-meta">{progress(rolloutIds)} required</span>
        </summary>
        <p className="helper">These details affect rollout, training, and managed-service pricing.</p>
        <div className="grid">
          {fields.input('people_count', 'How many people work on this process?', 'Approximate total people involved.', 'number')}
          {fields.input('department_count', 'How many teams or departments?', 'Count participating teams once.', 'number')}
        </div>
        {fields.select('cadence', 'How often should it run?', [
          ['monthly', 'Monthly'],
          ['weekly', 'Weekly'],
          ['daily', 'Daily'],
          ['realtime', 'As events happen'],
        ])}
        {fields.select('handover', 'Who needs training and handover?', [
          ['one', 'One person'],
          ['group', 'One team'],
          ['multiple', 'Several teams / sessions'],
        ])}
      </details>
      {marketingAreas.has(state.area) && (
        <details
          className="optional-section required-section estimate-details"
          name="estimate-essentials"
          defaultOpen={
            answeredCount(complexityIds) === complexityIds.length
            && answeredCount(rolloutIds) === rolloutIds.length
            && answeredCount(marketingIds) < marketingIds.length
          }
        >
          <summary>
            <span>3. Marketing scope</span>
            <span className="disclosure-meta">{progress(marketingIds)} required</span>
          </summary>
          <MarketingFields areaId={state.area} answers={state.answers} fields={fields} />
        </details>
      )}
      <details className="field-bank compact-details" defaultOpen={chosen.length > 0 && !state.analysis}>
        <summary>
          Review detailed scope{state.routes.length ? ` (${state.routes.length} selected)` : ' (optional)'}
        </summary>
        <p>
          Add or correct specific responsibilities only when they materially affect this estimate.
          These remain one connected system unless review identifies separate outcomes.
        </p>
        <div className="routes">
          {displayedRoutes.map((route) => (
            <button
              key={route}
              type="button"
              className={`route ${state.routes.includes(route) ? 'selected' : ''}`}
              aria-pressed={state.routes.includes(route)}
              onClick={() => onToggleRoute(route)}
            >
              {route}
            </button>
          ))}
        </div>
        <div className="scope-fields">{chosen.map(fields.bankField)}</div>
      </details>
      <QuestionBank candidates={candidates} visible={state.visible} onAdd={onAddField} />
      {state.analysis?.uncertainties?.length > 0 && (
        <div className="warning">
          {state.analysis.uncertainties.map((uncertainty) => <div key={uncertainty}>{uncertainty}</div>)}
        </div>
      )}
    </>
  );
}
