import { estimatorBank } from '../../../lib/domain.js';

export function DataSection({ answers, fields }) {
  const coreField = estimatorBank.dataFields.find((field) => field.id === 'documentation_readiness');
  const preparationField = estimatorBank.dataFields.find((field) => field.id === 'data_preparation_level');
  const locationField = estimatorBank.dataFields.find((field) => field.id === 'data_information_location');
  const ownerField = estimatorBank.dataFields.find((field) => field.id === 'data_preparation_owner');
  const hasAnswer = (id) => answers[id] !== null && answers[id] !== undefined && answers[id] !== '';
  const conditionalFields = estimatorBank.dataFields.filter((field) => {
    if (!field.conditional) return false;
    if (hasAnswer(field.id)) return true;
    if (field.id === 'data_material_volume') {
      return ['existing', 'partial', 'limited'].includes(answers.data_preparation_level);
    }
    if (field.id === 'data_material_format') {
      return ['partial', 'limited'].includes(answers.data_preparation_level);
    }
    if (field.id === 'data_material_restriction') {
      return ['Mostly staff knowledge', 'Not sure'].includes(answers.documentation_readiness)
        || answers.data_preparation_level === 'unknown';
    }
    return false;
  });
  return (
    <>
      <h2>Your documents and data.</h2>
      <p>
        These four answers help estimate preparation. Choose the $0 option only when both the
        instructions and data are complete, organized, current, consistent, and ready to use.
      </p>
      {fields.select(coreField.id, coreField.question, coreField.options.split(' / '))}
      {fields.select(locationField.id, locationField.question, locationField.options.split(' / '))}
      {fields.select(
        preparationField.id,
        'How ready are the instructions and data for this process?',
        [
          ['clean', 'Ready to use: both instructions and data are complete, organized, current, consistent, and need no preparation.'],
          ['existing', 'Instructions or data exist, but review, organizing, or source preparation is needed.'],
          ['partial', 'Some gaps, missing exceptions, or staff-held knowledge remain.'],
          ['limited', 'Most of the process knowledge is held by staff.'],
          ['unknown', 'Not sure.'],
        ],
        'Preparation amounts are provisional and validated during paid discovery.',
      )}
      {fields.select(ownerField.id, ownerField.question, ownerField.options.split(' / '))}
      <details className="field-bank compact-details">
        <summary>
          <span>Material details that may change scope</span>
          <span className="disclosure-meta">Optional</span>
        </summary>
        <p>Answer only when volume, format, conflict, or restricted access changes scope or feasibility.</p>
        {conditionalFields.map(fields.bankField)}
        <p className="helper">Detailed inspection and account setup are confirmed during paid discovery.</p>
      </details>
    </>
  );
}
