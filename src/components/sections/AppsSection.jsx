import { estimatorBank } from '../../lib/domain.js';

const primaryAppFields = [
  'systems',
  'legacy_system_check',
  'app_exact_product',
  'app_version_plan',
  'app_file_transfer',
  'app_known_restrictions',
  'app_alternative_approach',
  'app_required_actions',
  'app_output_destination',
];

export function AppsSection({ answers, fields }) {
  const legacyNeedsDetail = ['Customized', 'Older', 'Restricted', 'Not sure'].includes(answers.legacy_system_check);
  const findField = (id) => estimatorBank.appFields.find((field) => field.id === id);
  const optionalIds = estimatorBank.appFields
    .map((field) => field.id)
    .filter((id) => ![
      'systems',
      'legacy_system_check',
      'app_exact_product',
      'app_version_plan',
      'app_file_transfer',
      'app_known_restrictions',
      'app_alternative_approach',
    ].includes(id));
  const optionalCount = optionalIds.filter((id) =>
    answers[id] !== null && answers[id] !== undefined && answers[id] !== '',
  ).length;
  return (
    <>
      <h2>Your apps and software.</h2>
      <p>
        Only include apps involved in this process—for example, Shopify, a store POS, Wave,
        Gmail, Google Drive or Help Scout.
      </p>
      {fields.input('systems', 'Which apps or software are involved?', 'Separate names with commas. You can describe what an app does if you don’t know its name.', 'text', { list: 'appNames' })}
      <datalist id="appNames">
        {estimatorBank.appNames.map((name) => <option key={name} value={name} />)}
      </datalist>
      {fields.select('legacy_system_check', 'Is any required app customized, older, or restricted?', [
        'Standard', 'Customized', 'Older', 'Restricted', 'Not sure',
      ], 'Customized, older, unknown, or restricted connections require review; they are not automatic rejection.')}
      {legacyNeedsDetail && (
        <details className="field-bank compact-details" open>
          <summary>Connection details needed for review</summary>
          {fields.input('app_exact_product', 'Which product needs checking?', 'Name, vendor or description.')}
          {fields.input('app_version_plan', 'Do you know the version or plan?', 'Optional; leave blank if unknown.')}
          {fields.bankField(findField('app_known_restrictions'))}
          {fields.bankField(findField('app_file_transfer'))}
          {fields.bankField(findField('app_alternative_approach'))}
          <p className="helper">A restricted connection remains on hold until AOC confirms a supported or staff-assisted approach.</p>
        </details>
      )}
      <details className="field-bank compact-details">
        <summary>
          <span>App actions and destinations</span>
          <span className="disclosure-meta">{optionalCount ? `${optionalCount} answered` : 'Optional'}</span>
        </summary>
        <div className="subtle">
          <strong>We check the required action, not just the app name.</strong>
          <p>
            A listed integration does not prove it can read, create, update or send what this process
            needs. Unknown connections need review before audit purchase.
          </p>
        </div>
        {fields.bankField(findField('app_required_actions'))}
        {fields.bankField(findField('app_output_destination'))}
        {estimatorBank.appFields
          .filter((field) => !primaryAppFields.includes(field.id))
          .map(fields.bankField)}
      </details>
    </>
  );
}
