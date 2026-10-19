import { estimatorBank } from '../../lib/domain.js';

export function DataSection({ fields }) {
  const coreField = estimatorBank.dataFields.find((field) => field.id === 'documentation_readiness');
  const preparationField = estimatorBank.dataFields.find((field) => field.id === 'data_preparation_level');
  const optionalFields = estimatorBank.dataFields.filter(
    (field) => !field.conditional
      && !['documentation_readiness', 'data_preparation_level'].includes(field.id),
  );
  return (
    <>
      <h2>Your documents and data.</h2>
      <p>
        You don’t need polished documentation to get an estimate. We’ve filled in what you
        mentioned; confirm the overall condition.
      </p>
      {fields.select(coreField.id, coreField.question, coreField.options.split(' / '))}
      {fields.select(
        preparationField.id,
        preparationField.question,
        preparationField.options.split(' / '),
        'Substantial preparation needs a separate bounded review before the estimate is complete.',
      )}
      <details className="field-bank compact-details">
        <summary>
          <span>Preparation details</span>
          <span className="disclosure-meta">Optional</span>
        </summary>
        {optionalFields.map((field) => fields.select(field.id, field.question, field.options.split(' / ')))}
        <p>Only add these if they affect the scope or feasibility now. Exact inspection happens during the audit.</p>
        {estimatorBank.dataFields.filter((field) => field.conditional).map(fields.bankField)}
        <p className="helper">
          Preparation for this process can be part of the build. Company-wide knowledge
          infrastructure or workspace setup requires its own agreed scope.
        </p>
      </details>
    </>
  );
}
