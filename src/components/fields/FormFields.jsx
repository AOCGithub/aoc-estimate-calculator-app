function FieldLabel({ id, label, filled }) {
  return (
    <label htmlFor={`f_${id}`}>
      {label}
      {filled && <span className="filled">From your description</span>}
    </label>
  );
}

export function SelectField({ id, label, options, help = '', value, filled, onChange }) {
  return (
    <div className="field">
      <FieldLabel id={id} label={label} filled={filled} />
      <select id={`f_${id}`} value={value ?? ''} onChange={(event) => onChange(id, event.target.value)}>
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
  onChange,
  list,
}) {
  const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '');
  return (
    <div className="field">
      <FieldLabel id={id} label={label} filled={filled} />
      <input
        id={`f_${id}`}
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? 'any' : undefined}
        value={displayValue}
        list={list}
        placeholder="Not sure / leave blank"
        onChange={(event) => onChange(id, event.target.value)}
      />
      {help && <p className="helper">{help}</p>}
    </div>
  );
}

export function BankField({ field, value, filled, onChange }) {
  if (!field) return null;
  const options = String(field.options || '').split(/ · | \/ /).filter(Boolean);
  return (
    <div className="field">
      <FieldLabel id={field.id} label={field.question} filled={filled} />
      <input
        id={`f_${field.id}`}
        value={value ?? ''}
        list={`list_${field.id}`}
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
        onChange={mark}
      />
    ),
    bankField: (field) => (
      <BankField
        key={field?.id}
        field={field}
        value={state.answers[field?.id]}
        filled={Boolean(state.facts[field?.id])}
        onChange={mark}
      />
    ),
  };
}
