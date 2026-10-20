import { estimatorBank } from '../../lib/domain.js';

export function DataSection({ answers, fields }) {
  const coreField = estimatorBank.dataFields.find((field) => field.id === 'documentation_readiness');
  const preparationField = estimatorBank.dataFields.find((field) => field.id === 'data_preparation_level');
  const optionalFields = estimatorBank.dataFields.filter(
    (field) => !field.conditional
      && !['documentation_readiness', 'data_preparation_level'].includes(field.id),
  );
  const hasAnswer = (id) => answers[id] !== null && answers[id] !== undefined && answers[id] !== '';
  const conditionalFields = estimatorBank.dataFields.filter((field) => {
    if (!field.conditional) return false;
    if (hasAnswer(field.id)) return true;
    if (field.id === 'data_material_volume') {
      return ['Some preparation', 'Substantial preparation'].includes(answers.data_preparation_level);
    }
    if (field.id === 'data_material_format') {
      return answers.data_preparation_level === 'Substantial preparation';
    }
    if (field.id === 'data_material_restriction') {
      return ['Mostly staff knowledge', 'Not sure'].includes(answers.documentation_readiness)
        || answers.data_preparation_level === 'Not sure';
    }
    return false;
  });
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
        {conditionalFields.map(fields.bankField)}
        <p className="helper">
          Preparation for this process can be part of the build. Company-wide knowledge
          infrastructure or workspace setup requires its own agreed scope.
        </p>
      </details>
    </>
  );
}
