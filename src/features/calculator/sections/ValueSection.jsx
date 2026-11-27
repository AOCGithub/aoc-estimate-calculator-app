export function ValueSection({ answers, fields }) {
  const hasValueInputs = [
    'team_time',
    'blended_hourly_cost',
    'replacement_provider_cost',
    'software_replaced_cost',
  ].some((key) => answers[key] !== null && answers[key] !== undefined && answers[key] !== '');
  return (
    <>
      <h2>Time, costs and potential value.</h2>
      <p>
        Monthly team hours and approximate internal hourly cost are required for the baseline ROI.
        The result excludes future operating costs; unknown savings are not counted.
      </p>
      <div className="grid">
        {fields.input('team_time', 'Combined team hours each month', 'Across everyone doing this work.', 'number')}
        {fields.input('blended_hourly_cost', 'Approximate internal hourly cost (USD)', 'Use a reasonable blended estimate, not individual salaries.', 'number')}
      </div>
      <div className="subtle">
        <strong>The 80/20 planning illustration</strong>
        <p>80% of current time is shown as freed capacity; 20% remains for review, approvals, and exceptions. This is not a guaranteed payroll reduction.</p>
      </div>
      <h3>Confirmed costs this process would eliminate</h3>
      <p className="helper">Leave unknown costs blank. Only the portion confirmed to go away is counted.</p>
      {fields.input('replacement_provider_cost', 'Current monthly provider cost for comparable work (USD)', 'Optional; do not include media or advertising spend.', 'number')}
      {answers.replacement_provider_cost && fields.select('provider_replaced_portion', 'How much of that provider cost would be eliminated?', [
        ['none', 'None'],
        ['all', 'All of it'],
        ['part', 'Part of it'],
        ['unknown', 'Not sure'],
      ])}
      {answers.provider_replaced_portion === 'part' && fields.input('provider_removed_amount', 'Confirmed monthly provider savings (USD)', '', 'number')}
      {fields.input('software_replaced_cost', 'Current monthly cost of software this process would replace (USD)', 'Only include subscriptions that would actually be cancelled or reduced.', 'number')}
      {answers.software_replaced_cost && fields.select('software_replaced_portion', 'How much of that software cost would be eliminated?', [
        ['none', 'None'],
        ['all', 'All of it'],
        ['part', 'Part of it'],
        ['unknown', 'Not sure'],
      ])}
      {answers.software_replaced_portion === 'part' && fields.input('software_removed_amount', 'Confirmed monthly software savings (USD)', '', 'number')}
      {hasValueInputs && <p className="helper">Potential savings are shown only when the amount and eliminated portion are confirmed.</p>}
    </>
  );
}
