import { marketingAreas } from '../../constants.js';

export function ValueSection({ areaId, answers, fields }) {
  const hasValueInputs = [
    'team_time',
    'blended_hourly_cost',
    'replacement_provider_cost',
    'software_replaced_cost',
    'incremental_software_cost',
  ].some((key) => answers[key] !== null && answers[key] !== undefined && answers[key] !== '');
  return (
    <>
      <h2>Time, costs and potential value.</h2>
      <p>
        This section is optional. Add a few approximate figures only if you want an illustrative
        ROI and payback view; otherwise continue to responsibilities.
      </p>
      <details className="optional-section" defaultOpen={hasValueInputs}>
        <summary>
          <span>Calculate potential value</span>
          <span className="disclosure-meta">Optional</span>
        </summary>
        <p>Approximate figures are fine. Leave anything unknown blank.</p>
        <div className="grid">
          {fields.input('team_time', 'Total team hours each month', 'Across everyone doing this work.', 'number')}
          {fields.input('blended_hourly_cost', 'Average internal hourly cost (USD)', 'Your best blended estimate; no individual salaries needed.', 'number')}
        </div>
        <div className="subtle">
          <strong>The 80/20 planning illustration</strong>
          <p>80% of current time is freed for other work; 20% remains for checking, approvals and exceptions. The audit validates this assumption.</p>
        </div>
        {marketingAreas.has(areaId) && (
          <>
            <h3>Current provider costs</h3>
            {fields.input('replacement_provider_cost', 'What do you pay a provider for this same work each month?', 'This could be AOC or another provider. Enter only comparable work.', 'number')}
            {fields.select('provider_replaced_portion', 'How much of that fee would go away?', [
              ['none', 'Nothing / no current provider fee'],
              ['all', 'Entire entered fee'],
              ['part', 'A specific portion'],
              ['unknown', 'Not sure'],
            ])}
            {answers.provider_replaced_portion === 'part' && fields.input('provider_removed_amount', 'Monthly portion actually replaced (USD)', '', 'number')}
          </>
        )}
        <h3>Paid apps that would be replaced</h3>
        {fields.input('software_replaced_cost', 'Current monthly cost of apps this process could replace', 'Connecting an app does not mean its subscription goes away.', 'number')}
        {fields.select('software_replaced_portion', 'How much of that app cost would go away?', [
          ['none', 'Nothing / no apps replaced'],
          ['all', 'Entire entered cost'],
          ['part', 'A specific portion'],
          ['unknown', 'Not sure'],
        ])}
        {answers.software_replaced_portion === 'part' && fields.input('software_removed_amount', 'Monthly app cost actually eliminated (USD)', '', 'number')}
        {fields.input('incremental_software_cost', 'Already known added subscriptions or usage (USD/month)', 'Optional estimate; zero only if confirmed none. AOC validates this during the audit.', 'number')}
      </details>
    </>
  );
}
