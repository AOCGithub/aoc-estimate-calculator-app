import { estimatorBank } from '../../lib/domain.js';

function recommendedTier(answers) {
  if (
    answers.business_impact === 'Essential operations stop or serious financial harm'
    || answers.response_need === 'urgent'
  ) return 'Critical may be appropriate; eligibility and coverage need confirmation.';
  if (
    answers.business_impact === 'Customers or important deadlines affected'
    || answers.response_need === 'hours'
  ) return 'Priority may be appropriate for this time-sensitive process.';
  return 'Choose coverage based on impact and how quickly you need attention. We can help decide.';
}

export function ServiceSection({ answers, confirmed, fields, onConfirm, onMark }) {
  const findField = (id) => estimatorBank.serviceFields.find((field) => field.id === id);
  return (
    <>
      <h2>Responsibilities and ongoing service.</h2>
      <p>
        Choose how the agreed process should be managed. Support coverage and routine expert review
        are different parts of the scope.
      </p>
      {fields.select('responsibility_split', 'After launch, how would you like this managed?', [
        ['aoc', 'AOC manages it'],
        ['client', 'Our team manages it'],
        ['shared', 'Shared responsibility'],
        ['help', 'Help me decide'],
      ])}
      {fields.select('action_mode', 'Before it sends something or makes a change, what should happen?', [
        ['draft', 'Prepare drafts for a person to approve'],
        ['approved', 'Make changes after approval'],
        ['automatic', 'Routine work proceeds within agreed limits'],
      ])}
      {answers.action_mode && answers.action_mode !== 'draft' && fields.select(
        'consequential',
        'Could these actions affect money, stock, orders or sensitive records?',
        [['yes', 'Yes'], ['no', 'No']],
        'This identifies safeguards; it does not automatically authorize an action.',
      )}
      {answers.management === 'yes' && (
        <>
          <h3>Select support coverage</h3>
          <p className="helper">{recommendedTier(answers)}</p>
          <div className="tiers">
            {[
              ['standard', 'Standard', 'Routine support in defined business hours.'],
              ['priority', 'Priority', 'Faster investigation and broader coverage.'],
              ['critical', 'Critical', 'Qualifying urgent incidents; availability must be confirmed.'],
            ].map(([value, title, description]) => (
              <button
                key={value}
                type="button"
                className={`tier ${answers.tier === value ? 'selected' : ''}`}
                aria-pressed={answers.tier === value}
                onClick={() => onMark('tier', value)}
              >
                {title}<small>{description}</small>
              </button>
            ))}
          </div>
          <p className="proposed">Draft pricing only. Exact hours, response targets and change allowances require agreement.</p>
        </>
      )}
      {answers.management === 'no' && (
        <div className="subtle">
          <strong>Self-managed</strong>
          <p>No AOC monthly management fee. Ad hoc support: $150/hour, with a $150 minimum per ticket, subject to availability.</p>
        </div>
      )}
      <details className="field-bank compact-details">
        <summary>
          <span>Responsibility and coverage details</span>
          <span className="disclosure-meta">Optional</span>
        </summary>
        {fields.bankField(findField('client_retained_work'))}
        {['aoc', 'shared', 'help'].includes(answers.responsibility_split)
          && fields.bankField(findField('aoc_owned_work'))}
        {fields.select('human_review_boundary', 'Who should review the work?', [
          'Our team',
          'AOC expert',
          'Both at different checkpoints',
          'Routine work within agreed rules',
          'Help me decide',
        ])}
        {fields.select('business_impact', 'If this stops working or produces incorrect results, what happens?', [
          'Minor inconvenience',
          'Manual fallback with delay',
          'Customers or important deadlines affected',
          'Essential operations stop or serious financial harm',
          'Not sure',
        ])}
        {fields.select('response_need', 'How quickly should someone start investigating?', [
          ['next', 'Next business day'],
          ['hours', 'Within a few working hours'],
          ['urgent', 'Urgently, including outside business hours'],
          ['recommend', 'Recommend coverage'],
        ], 'Investigation starting is different from fixing the issue.')}
        {fields.select('operating_window', 'When does this process need to run?', [
          'Business hours', 'Extended hours', 'Around the clock', 'Specific dates or deadlines', 'Not sure',
        ])}
        {estimatorBank.serviceFields.filter((field) => field.conditional).map(fields.bankField)}
        <h3>What monthly service covers</h3>
        <p className="small">
          Agreed monitoring, investigation, maintenance repairs, agent-quality checks and reporting.
          New workflows, connected systems, significant rule or authority changes, and redesign are
          separately estimated. Software subscriptions and usage are separate.
        </p>
      </details>
      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
        I’ve reviewed the description and answers. Unknown items and assumptions remain subject to validation.
      </label>
    </>
  );
}
