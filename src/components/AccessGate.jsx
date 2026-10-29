import { useState } from 'react';

const emptyProfile = {
  name: '',
  company: '',
  website: '',
  role: '',
  businessEmail: '',
};

const fields = [
  ['name', 'Your name', 'text', 'Your full name'],
  ['company', 'Company', 'text', 'Company name'],
  ['website', 'Company website', 'text', 'example.com'],
  ['role', 'Your role', 'text', 'Your role'],
  ['businessEmail', 'Business email', 'email', 'you@company.com'],
];

export function AccessGate({ access }) {
  const [profile, setProfile] = useState(emptyProfile);

  if (access.loading) {
    return (
      <div className="access-page">
        <header className="access-header">
          <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
          <span className="access-header-badge"><i /> Secure access</span>
        </header>
        <main className="access-shell">
          <section className="access-card access-card--loading" aria-live="polite">
            <div className="access-loading" aria-hidden="true" />
            <h1>Checking access</h1>
            <p>Please wait while we confirm your access.</p>
          </section>
        </main>
      </div>
    );
  }

  async function submit(event) {
    event.preventDefault();
    await access.verify(profile);
  }

  return (
    <div className="access-page">
      <header className="access-header">
        <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
        <span className="access-header-badge"><i /> Secure access</span>
      </header>
      <main className="access-shell">
        <section className="access-card">
          <div className="access-intro">
            <div className="access-intro__content">
              <div className="access-eyebrow"><span /> AOC APPROVED ACCESS</div>
              <h1>Continue to the AI Commerce estimator</h1>
              <p>
                Turn a business process into a clear, editable scope and explore the right delivery
                route with Always Open Commerce.
              </p>
              <ol className="access-steps" aria-label="Access process">
                <li><span>1</span><div><strong>Confirm your details</strong><small>Enter your business information.</small></div></li>
                <li><span>2</span><div><strong>Confirm your access</strong><small>Use the business email approved by AOC.</small></div></li>
                <li><span>3</span><div><strong>Explore your estimate</strong><small>Review every answer before calculating.</small></div></li>
              </ol>
            </div>
            <div className="access-trust" aria-label="Access assurances">
              <span><i>✓</i> Session only</span>
              <span><i>✓</i> Editable answers</span>
              <span><i>✓</i> No marketing</span>
            </div>
          </div>

          <div className="access-form-panel">
            <div className="access-form-heading">
              <span>SECURE CALCULATOR ACCESS</span>
              <h2>Your access details</h2>
              <p>
                Enter your company details and the business email approved by AOC.
              </p>
            </div>
            <form className="access-form" onSubmit={submit}>
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
                      inputMode={id === 'businessEmail' ? 'email' : id === 'website' ? 'url' : undefined}
                      autoComplete={id === 'businessEmail' ? 'email' : id === 'name' ? 'name' : 'organization'}
                      required
                      maxLength={id === 'website' ? 500 : id === 'businessEmail' ? 254 : 120}
                      onChange={event => setProfile(current => ({ ...current, [id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {access.error && <p className="access-error" role="alert">{access.error}</p>}
              <button type="submit" className="primary access-submit" disabled={access.working || !access.configured}>
                <span>{access.working ? 'Checking access…' : 'Continue to estimator'}</span>
                {!access.working && <i aria-hidden="true">→</i>}
              </button>
            </form>
            <div className="access-privacy">
              <span className="access-privacy__icon" aria-hidden="true">✓</span>
              <div>
                <strong>Access and privacy</strong>
                <p>
                  These details are used to confirm access to the calculator. We do not request
                  LinkedIn access or email-inbox access, save a reusable profile, enroll you in
                  marketing or send unsolicited follow-up.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
