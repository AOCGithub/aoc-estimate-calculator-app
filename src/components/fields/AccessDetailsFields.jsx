export const emptyAccessProfile = { name: '', company: '', website: '', role: '', businessEmail: '' };

const fields = [
  ['name', 'Your name', 'text', 'Your full name'],
  ['company', 'Company', 'text', 'Company name'],
  ['website', 'Company website', 'text', 'example.com'],
  ['role', 'Your role', 'text', 'Your role'],
  ['businessEmail', 'Business email', 'email', 'you@company.com'],
];

export function AccessDetailsFields({ profile, onChange, review = false }) {
  return (
    <div className="grid">
      {fields.map(([id, label, type, placeholder]) => (
        <div className={'field access-field' + (id === 'businessEmail' ? ' access-field--wide' : '')} key={id}>
          <label htmlFor={'access-' + id}>{label}</label>
          <input
            id={'access-' + id}
            name={id}
            type={type}
            value={profile[id]}
            placeholder={placeholder}
            required
            inputMode={id === 'businessEmail' ? 'email' : id === 'website' ? 'url' : undefined}
            autoComplete={id === 'businessEmail' ? 'email' : id === 'name' ? 'name'
              : review && id === 'website' ? 'url' : review && id === 'role' ? 'organization-title' : 'organization'}
            maxLength={id === 'website' ? 500 : id === 'businessEmail' ? 254 : review && id !== 'company' ? 100 : 120}
            onChange={event => onChange(current => ({ ...current, [id]: event.target.value }))}
          />
        </div>
      ))}
    </div>
  );
}
