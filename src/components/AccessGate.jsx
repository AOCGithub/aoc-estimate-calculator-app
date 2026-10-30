import { useState } from 'react';
import { ManualAccessGate } from './ManualAccessGate.jsx';
import { AccessDetailsFields, emptyAccessProfile } from './fields/AccessDetailsFields.jsx';

export function AccessGate({ access }) {
  const [profile, setProfile] = useState(emptyAccessProfile);

  if (access.loading) {
    return (
      <div className="access-page">
        <header className="access-header">
          <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
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

  if (access.manualApproval) return <ManualAccessGate access={access} />;

  async function submit(event) {
    event.preventDefault();
    await access.verify(profile);
  }

  return (
    <div className="access-page">
      <header className="access-header">
        <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
      </header>
      <main className="access-shell">
        <section className="access-card">
          <div className="access-intro">
            <div className="access-intro__content">
              <div className="access-eyebrow"><span /> {access.intakeOnly ? 'AI COMMERCE ESTIMATOR' : 'AOC APPROVED ACCESS'}</div>
              <h1>Continue to the AI Commerce estimator</h1>
              <p>
                Turn a business process into a clear, editable scope and explore the right delivery
                route with Always Open Commerce.
              </p>
              <ol className="access-steps" aria-label="Access process">
                <li><span>1</span><div><strong>Confirm your details</strong><small>Enter your business information.</small></div></li>
                <li><span>2</span><div><strong>{access.intakeOnly ? 'Save your details' : access.requestsEnabled ? 'Request access' : 'Confirm your access'}</strong><small>{access.intakeOnly ? 'Your details are saved before you continue.' : access.requestsEnabled ? 'AOC reviews requests before granting access.' : 'Use the business email approved by AOC.'}</small></div></li>
                <li><span>3</span><div><strong>Explore your estimate</strong><small>Review every answer before calculating.</small></div></li>
              </ol>
            </div>
            <div className="access-trust" aria-label="Access assurances">
              <span><i>✓</i> {access.intakeOnly ? 'Private details' : access.requestsEnabled ? 'Private access review' : 'Session only'}</span>
              <span><i>✓</i> Editable answers</span>
              <span><i>✓</i> No marketing</span>
            </div>
          </div>

          <div className="access-form-panel">
            <div className="access-form-heading">
              <span>{access.intakeOnly ? 'CALCULATOR PREVIEW' : 'SECURE CALCULATOR ACCESS'}</span>
              <h2>Your access details</h2>
              <p>
                {access.intakeOnly ? 'Enter your business details to continue. Verification and approval are on hold for this temporary preview.' : access.requestsEnabled ? 'Enter your business details to request access. Already approved? Use your approved email.' : 'Enter your company details and the business email approved by AOC.'}
              </p>
            </div>
            {access.pending ? (
              <div className="access-form">
                <div role="status" aria-live="polite">
                  <h3>Request received</h3>
                  <p>Your details have been saved for AOC to review. Calculator access is not yet approved.</p>
                </div>
                <button type="button" onClick={access.resetRequest}>Back to form</button>
              </div>
            ) : <form className="access-form" onSubmit={submit}>
              <AccessDetailsFields profile={profile} onChange={setProfile} />
              {access.error && <p className="access-error" role="alert">{access.error}</p>}
              <button type="submit" className="primary access-submit" disabled={access.working || !access.configured}>
                <span>{access.working ? (access.intakeOnly ? 'Saving details…' : access.requestsEnabled ? 'Submitting request…' : 'Checking access…') : (access.intakeOnly ? 'Continue to calculator' : access.requestsEnabled ? 'Request access / continue' : 'Continue to estimator')}</span>
                {!access.working && <i aria-hidden="true">→</i>}
              </button>
            </form>}
            <div className="access-privacy">
              <span className="access-privacy__icon" aria-hidden="true">✓</span>
              <div>
                <strong>Access and privacy</strong>
                <p>
                  {access.recordsEnabled && 'When you calculate, your answers and results are also saved privately and linked to this submission. '}
                  {access.intakeOnly ? 'Your name, company, website, role and business email are saved privately as an access submission. This preview does not verify your identity or wait for approval. ' : access.requestsEnabled ? 'Your name, company, website, role and business email are saved privately for access review. ' : 'These details are used to confirm access to the calculator. '}We do not request
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
