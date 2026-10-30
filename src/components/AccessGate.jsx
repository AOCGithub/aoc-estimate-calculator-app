import { useState } from 'react';
import { ManualAccessGate } from './ManualAccessGate.jsx';
import { AccessDetailsFields, emptyAccessProfile } from './fields/AccessDetailsFields.jsx';

export function AccessGate({ access }) {
  const [profile, setProfile] = useState(emptyAccessProfile);
  const [saveData, setSaveData] = useState(false);

  if (access.loading) {
    return (
      <div className="access-page">
        <header className="access-header">
          <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
        </header>
        <main className="access-shell" aria-busy="true" aria-label="Loading calculator" />
      </div>
    );
  }

  if (access.manualApproval) return <ManualAccessGate access={access} />;

  async function submit(event) {
    event.preventDefault();
    await access.verify(access.intakeOnly ? { ...profile, saveData } : profile);
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
                <li><span>2</span><div><strong>{access.intakeOnly ? 'Choose whether to save' : access.requestsEnabled ? 'Request access' : 'Confirm your access'}</strong><small>{access.intakeOnly ? 'Saving your details and estimates is optional.' : access.requestsEnabled ? 'AOC reviews requests before granting access.' : 'Use the business email approved by AOC.'}</small></div></li>
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
              {access.intakeOnly && <div className="access-saving-choice">
                <label htmlFor="access-save-data"><input id="access-save-data" name="saveData" type="checkbox"
                  checked={saveData} disabled={access.working || !access.savingAvailable}
                  aria-describedby="access-saving-help" onChange={event => setSaveData(event.target.checked)} />
                  Save my details{access.recordsEnabled ? ' and estimates' : ''} with AOC (optional)
                </label>
                <p id="access-saving-help">Leave unchecked to use the calculator without saving your business details{access.recordsEnabled ? ' or estimate records' : ''} to AOC’s database.
                  {!access.savingAvailable && ' Saving is currently unavailable; you can continue without it.'}</p>
              </div>}
              {access.error && <p className="access-error" role="alert">{access.error}</p>}
              <button type="submit" className="primary access-submit" disabled={access.working || !access.configured}>
                <span>{access.working ? (access.intakeOnly ? saveData ? 'Saving details…' : 'Opening calculator…' : access.requestsEnabled ? 'Submitting request…' : 'Checking access…') : (access.intakeOnly ? 'Continue to calculator' : access.requestsEnabled ? 'Request access / continue' : 'Continue to estimator')}</span>
                {!access.working && <i aria-hidden="true">→</i>}
              </button>
            </form>}
            <div className="access-privacy">
              <span className="access-privacy__icon" aria-hidden="true">✓</span>
              <div>
                <strong>Access and privacy</strong>
                <p>
                  {access.intakeOnly ? 'You choose whether AOC saves your business details and estimates. Without saving, the calculator still works for your session. AI features still process descriptions you submit. Verification and approval remain on hold. ' : access.requestsEnabled ? 'Your name, company, website, role and business email are saved privately for access review. ' : 'These details are used to confirm access to the calculator. '}We do not request
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
