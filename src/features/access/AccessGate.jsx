import { useState } from 'react';
import { ManualAccessGate } from './ManualAccessGate.jsx';
import { AccessDetailsFields, emptyAccessProfile } from './AccessDetailsFields.jsx';
import Aurora from '../../components/visuals/Aurora.jsx';
import { ClientProfileReview } from '../profiles/ClientProfileReview.jsx';
import { Brand } from '../../components/Brand.jsx';

const auroraColors = ['#087E79', '#57C4A5', '#295C80'];

export function AccessGate({ access, profiles = { enabled: false, working: false } }) {
  const [profile, setProfile] = useState(emptyAccessProfile);
  const [saveData, setSaveData] = useState(false);
  const [rememberProfile, setRememberProfile] = useState(false);
  const [reuseConfirmed, setReuseConfirmed] = useState(false);
  const busy = access.working || profiles.working;

  if (access.loading) {
    return (
      <div className="access-page">
        <header className="access-header">
          <Brand />
        </header>
        <main className="access-shell" aria-busy="true" aria-label="Loading calculator" />
      </div>
    );
  }

  if (access.manualApproval) return <ManualAccessGate access={access} />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (profiles.enabled && rememberProfile && !await profiles.save(profile, reuseConfirmed)) return;
    const outcome = await access.verify(access.intakeOnly ? { ...profile, saveData } : profile);
    if (outcome?.ok && profiles.enabled) profiles.cancelReview();
  }

  return (
    <div className="access-page access-page--aurora">
      <header className="access-header">
        <Brand />
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
                <h1>A clearer picture<br />of <span>what’s next.</span></h1>
                <p>
                  Turn a business process into a clear, editable scope and explore the right delivery
                  route with Always Open Commerce.
                </p>
              </div>
            </div>
            <div className="access-visual-caption"><span>Always Open Commerce</span><span>Built around your business.</span></div>
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
                <ClientProfileReview profiles={profiles} onReuse={() => {
                  const reused = profiles.reuse(profile);
                  if (reused) { setProfile(reused); setReuseConfirmed(true); }
                }} />
                <AccessDetailsFields profile={profile} onChange={setProfile} disabled={busy} />
                {profiles.enabled ? <div className="access-saving-choice">
                  <label htmlFor="remember-client-profile"><input id="remember-client-profile" type="checkbox"
                    checked={rememberProfile} disabled={busy || !profiles.available}
                    aria-describedby="remember-profile-help" onChange={event => setRememberProfile(event.target.checked)} />
                    Remember my business details for next time (optional)
                  </label>
                  <p id="remember-profile-help">Remember these details in this browser for {profiles.retentionDays} days after you save, and review them before reuse. Choose company facts separately inside the calculator. Leave unchecked for this session only. You can delete the profile at any time.</p>
                </div> : null}
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
                <button type="submit" className="primary access-submit" disabled={busy || !access.configured}>
                  <span>{profiles.working ? 'Please wait…' : access.working ? (access.intakeOnly ? saveData ? 'Saving details…' : 'Opening calculator…' : access.requestsEnabled ? 'Submitting request…' : 'Checking access…') : (access.intakeOnly ? 'Continue to calculator' : access.requestsEnabled ? 'Request access / continue' : 'Continue to estimator')}</span>
                  {!busy && <i aria-hidden="true">→</i>}
                </button>
              </form>}
              <details className="access-privacy">
                <summary>Access and privacy</summary>
                <span className="access-privacy__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-5" />
                  </svg>
                </span>
                <div>
                  <p>
                    {profiles.enabled ? 'Profile saving and estimate recording are separate optional choices. Profiles are stored privately with AOC and accessed using a private browser cookie. Clearing that cookie removes access from this browser. AI features still process descriptions you submit. Identity verification and approval remain on hold. ' : access.intakeOnly ? 'You choose whether AOC saves your business details and estimates. Without saving, the calculator still works for your session. AI features still process descriptions you submit. Verification and approval remain on hold. ' : access.requestsEnabled ? 'Your name, company, website, role and business email are saved privately for access review. ' : 'These details are used to confirm access to the calculator. '}We do not request
                    LinkedIn access or email-inbox access, {profiles.enabled ? '' : 'save a reusable profile, '}enroll you in
                    marketing or send unsolicited follow-up.
                  </p>
                </div>
              </details>
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
