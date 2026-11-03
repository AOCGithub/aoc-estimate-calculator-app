import { useState } from 'react';
import { ManualAccessGate } from './ManualAccessGate.jsx';
import { AccessDetailsFields, emptyAccessProfile } from './fields/AccessDetailsFields.jsx';
import Aurora from './visuals/Aurora.jsx';

const auroraColors = ['#087E79', '#57C4A5', '#295C80'];

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
    <div className="access-page access-page--aurora">
      <header className="access-header">
        <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
      </header>
      <main className="access-shell">
        <section className="access-card">
          <div className="access-visual">
            <Aurora colorStops={auroraColors} amplitude={0.65} blend={0.8} height={0.6}
              speed={0.35} scale={0.7} glow={0.35} brightness={0.85} direction="bottom"
              mouseInteraction={false} intro={false} dpr={1} />
            <div className="access-intro">
              <div className="access-intro__content">
                <div className="access-eyebrow"><span /> {access.intakeOnly ? 'AI COMMERCE ESTIMATOR' : 'AOC APPROVED ACCESS'}</div>
                <h1>Always Open Commerce <span>Estimator.</span></h1>
                <p>
                  Turn a business process into a clear, editable scope and explore the right delivery
                  route with Always Open Commerce.
                </p>
              </div>
            </div>
          </div>

          <div className="access-entry">
            <div className="access-form-panel">
              <div className="access-form-heading">
                <span className="access-form-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" />
                    <path d="M6 16c0-3 6-3 6 0m3-7h3m-3 4h3" />
                  </svg>
                </span>
                <h2>Your business details</h2>
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
                <span className="access-privacy__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-5" />
                  </svg>
                </span>
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
            <div className="access-trust" aria-label="Access assurances">
              <span><i>✓</i> {access.intakeOnly ? 'Private details' : access.requestsEnabled ? 'Private access review' : 'Session only'}</span>
              <span><i>✓</i> Editable answers</span>
              <span><i>✓</i> No marketing</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
