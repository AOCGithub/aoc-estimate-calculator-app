function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}

function requiredFields(state) {
  const required = new Set([
    'people_count',
    'department_count',
    'systems',
    'workspace_context',
    'ai_account_context',
    'documentation_readiness',
    'data_information_location',
    'data_preparation_level',
    'data_preparation_owner',
    'team_time',
    'blended_hourly_cost',
  ]);

  if (state.answers.action_mode === 'automatic') required.add('consequential');
  return required;
}

function FieldLabel({ id, label, filled, required, missing }) {
  return (
    <label htmlFor={`f_${id}`}>
      {label}
      {filled && <span className="filled">{filled === 'profile' ? 'From confirmed profile' : 'From your description'}</span>}
      {required && missing && (
        <span id={`f_${id}_requirement`} className="required-indicator">Required</span>
      )}
    </label>
  );
}

export function SelectField({ id, label, options, help = '', value, filled, required, onChange }) {
  const missing = required && !hasAnswer(value);
  return (
    <div className={`field ${missing ? 'field--missing-required' : ''}`}>
      <FieldLabel id={id} label={label} filled={filled} required={required} missing={missing} />
      <select
        id={`f_${id}`}
        value={value ?? ''}
        required={required}
        aria-invalid={missing ? 'true' : undefined}
        aria-describedby={missing ? `f_${id}_requirement` : undefined}
        onChange={(event) => onChange(id, event.target.value)}
      >
        <option value="">Not sure / not provided</option>
        {options.map((option) => {
          const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
          return (
            <option key={String(optionValue)} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      {help && <p className="helper">{help}</p>}
    </div>
  );
}

export function InputField({
  id,
  label,
  help = '',
  type = 'text',
  value,
  filled,
  required,
  onChange,
  list,
  min,
}) {
  const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '');
  const missing = required && !hasAnswer(value);
  return (
    <div className={`field ${missing ? 'field--missing-required' : ''}`}>
      <FieldLabel id={id} label={label} filled={filled} required={required} missing={missing} />
      <input
        id={`f_${id}`}
        type={type}
        min={type === 'number' ? (min ?? '0') : undefined}
        step={type === 'number' ? 'any' : undefined}
        value={displayValue}
        list={list}
        required={required}
        aria-invalid={missing ? 'true' : undefined}
        aria-describedby={missing ? `f_${id}_requirement` : undefined}
        placeholder="Not sure / leave blank"
        onChange={(event) => onChange(id, event.target.value)}
      />
      {help && <p className="helper">{help}</p>}
    </div>
  );
}

export function BankField({ field, value, filled, required, onChange, onRemove }) {
  if (!field) return null;
  const options = String(field.options || '').split(/\s*(?:Â·|·|\/)\s*/).filter(Boolean);
  const missing = required && !hasAnswer(value);
  return (
    <div className={`field ${missing ? 'field--missing-required' : ''}`}>
      <div className="scope-question-heading">
        <FieldLabel
          id={field.id}
          label={field.question}
          filled={filled}
          required={required}
          missing={missing}
        />
        {onRemove && !required && (
          <button type="button" className="remove-question" aria-label={`Remove question: ${field.question}`} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <input
        id={`f_${field.id}`}
        value={value ?? ''}
        list={`list_${field.id}`}
        required={required}
        aria-invalid={missing ? 'true' : undefined}
        aria-describedby={missing ? `f_${field.id}_requirement` : undefined}
        placeholder="Choose, describe, or leave unknown"
        onChange={(event) => onChange(field.id, event.target.value)}
      />
      <datalist id={`list_${field.id}`}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
      {field.options && <p className="helper">{field.options}</p>}
    </div>
  );
}

export function createFieldProps(state, mark) {
  const required = requiredFields(state);
  return {
    answers: state.answers,
    facts: state.facts,
    input: (id, label, help = '', type = 'text', extra = {}) => (
      <InputField
        key={id}
        id={id}
        label={label}
        help={help}
        type={type}
        value={state.answers[id]}
        filled={state.profileSources?.[id] ? 'profile' : Boolean(state.facts[id])}
        required={required.has(id)}
        min={['team_time', 'blended_hourly_cost'].includes(id) ? '0.01' : undefined}
        onChange={mark}
        {...extra}
      />
    ),
    select: (id, label, options, help = '') => (
      <SelectField
        key={id}
        id={id}
        label={label}
        options={options}
        help={help}
        value={state.answers[id]}
        filled={state.profileSources?.[id] ? 'profile' : Boolean(state.facts[id])}
        required={required.has(id)}
        onChange={mark}
      />
    ),
    bankField: (field, onRemove) => (
      <BankField
        key={field?.id}
        field={field}
        value={state.answers[field?.id]}
        filled={state.profileSources?.[field?.id] ? 'profile' : Boolean(state.facts[field?.id])}
        required={required.has(field?.id)}
        onChange={mark}
        onRemove={typeof onRemove === 'function' ? onRemove : undefined}
      />
    ),
  };
}
