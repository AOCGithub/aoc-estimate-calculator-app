import { useState } from 'react';
import { scopeQuestions } from '../scopeQuestions.js';
import { QuestionBank } from './QuestionBank.jsx';

export function ScopeSection({ state, area, fields, onToggleRoute, onAddField, onRemoveField }) {
  const [query, setQuery] = useState('');
  const candidates = scopeQuestions(area);
  const chosen = candidates.filter((field) => state.visible.includes(field.id));
  const allRoutes = [...new Set([...area.routes, ...state.routes])]
    .filter((route) => route && !/Shared oversight/i.test(route));
  const displayedRoutes = allRoutes.filter((route, index) =>
    state.routes.includes(route) || index < 6,
  );
  const hasAnswer = (id) =>
    state.answers[id] !== null && state.answers[id] !== undefined && state.answers[id] !== '';
  const complexityIds = [
    'steps_band',
    'variation_band',
  ];
  const rolloutIds = [
    'people_count',
    'department_count',
  ];
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
            Initial technical direction: {state.analysis.solution}. AOC confirms the approach during paid discovery.
          </span>
        </div>
      ) : (
        <div className="subtle">
          No AI analysis yet. You can still describe the stages and choose relevant details.
        </div>
      )}

      <details
        className="optional-section required-section estimate-details"
        name="estimate-essentials"
        defaultOpen={answeredCount(complexityIds) < complexityIds.length}
      >
        <summary>
          <span>Process complexity</span>
          <span className="disclosure-meta">{progress(complexityIds)} answered</span>
        </summary>
        <p className="helper">Approximate answers are enough. Missing complexity answers default to Moderate unless a higher known answer applies.</p>
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
        <p className="helper">People and departments affect the fixed-price estimate. Unknown workload uses a disclosed planning assumption.</p>
        <div className="grid">
          {fields.input('people_count', 'How many people work on this process?', 'Approximate total people involved.', 'number', { min: '1' })}
          {fields.input('department_count', 'How many teams or departments?', 'Count participating teams once.', 'number', { min: '1' })}
        </div>
        {fields.select('cadence', 'How often should it run?', [
          ['monthly', 'Monthly'],
          ['weekly', 'Weekly'],
          ['daily', 'Daily'],
          ['hourly', 'Hourly'],
          ['realtime', 'As events happen'],
        ], 'Used for a planning estimate only; the actual schedule is confirmed during paid discovery.')}
      </details>
      <details className="optional-section estimate-details" name="estimate-essentials">
        <summary>Action and review approach</summary>
        <p className="helper">If not yet decided, the estimate assumes review-first handling.</p>
        {fields.select('action_mode', 'What should happen before a message is sent or a record changes?', [
          ['draft', 'Prepare a draft for a person to review'],
          ['approved', 'Make the change after a person approves it'],
          ['automatic', 'Allow routine actions within agreed limits'],
        ])}
        {state.answers.action_mode === 'automatic' && fields.select(
          'consequential',
          'Could those automatic actions affect money, stock, orders, or sensitive records?',
          [['yes', 'Yes'], ['no', 'No']],
          'Consequential automatic actions need additional safeguards.',
        )}
      </details>
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
        <div className="scope-fields">{chosen.map((field) => fields.bankField(field, () => {
          if (onRemoveField(field) !== false) setQuery(field.question);
        }))}</div>
      </details>
      <QuestionBank candidates={candidates} visible={state.visible} onAdd={onAddField} query={query} onQueryChange={setQuery} />
      {state.analysis?.uncertainties?.length > 0 && (
        <div className="warning">
          {state.analysis.uncertainties.map((uncertainty) => <div key={uncertainty}>{uncertainty}</div>)}
        </div>
      )}
    </>
  );
}
