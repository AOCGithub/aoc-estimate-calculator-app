import { marketingAreas } from '../../constants.js';

function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}

function requiredFields(state) {
  const required = new Set([
    'solution',
    'steps_band',
    'variation_band',
    'people_count',
    'department_count',
    'cadence',
    'handover',
    'systems',
    'legacy_system_check',
    'documentation_readiness',
    'data_preparation_level',
    'responsibility_split',
    'action_mode',
    'implementation_route',
    'delivery_intent',
    'existing_client',
  ]);

  if (state.answers.solution === 'agent') required.add('decision_band');
  if (state.answers.implementation_route === 'monthly') required.add('monthly_plan');
  if (state.answers.action_mode && state.answers.action_mode !== 'draft') required.add('consequential');

  if (marketingAreas.has(state.area)) {
    ['capability_count', 'brand_count', 'language_count', 'delivery_mode']
      .forEach((id) => required.add(id));
    if (state.area === 'area7') {
      required.add('channel_count');
      required.add('format_count');
    }
    if (state.area === 'area8') {
      ['initial_pages', 'keyword_count', 'market_count'].forEach((id) => required.add(id));
    }
    if (state.answers.delivery_mode === 'managed') {
      if (state.area === 'area8') {
        required.add('monthly_pages');
        required.add('monthly_articles');
      } else {
        required.add('monthly_outputs');
      }
    }
  }

  return required;
}

function FieldLabel({ id, label, filled, required, missing }) {
  return (
    <label htmlFor={`f_${id}`}>
      {label}
      {filled && <span className="filled">From your description</span>}
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
}) {
  const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '');
  const missing = required && !hasAnswer(value);
  return (
    <div className={`field ${missing ? 'field--missing-required' : ''}`}>
      <FieldLabel id={id} label={label} filled={filled} required={required} missing={missing} />
      <input
        id={`f_${id}`}
        type={type}
        min={type === 'number' ? '0' : undefined}
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

export function BankField({ field, value, filled, required, onChange }) {
  if (!field) return null;
  const options = String(field.options || '').split(/\s*(?:Â·|·|\/)\s*/).filter(Boolean);
  const missing = required && !hasAnswer(value);
  return (
    <div className={`field ${missing ? 'field--missing-required' : ''}`}>
      <FieldLabel
        id={field.id}
        label={field.question}
        filled={filled}
        required={required}
        missing={missing}
      />
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
        filled={Boolean(state.facts[id])}
        required={required.has(id)}
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
        filled={Boolean(state.facts[id])}
        required={required.has(id)}
        onChange={mark}
      />
    ),
    bankField: (field) => (
      <BankField
        key={field?.id}
        field={field}
        value={state.answers[field?.id]}
        filled={Boolean(state.facts[field?.id])}
        required={required.has(field?.id)}
        onChange={mark}
      />
    ),
  };
}
