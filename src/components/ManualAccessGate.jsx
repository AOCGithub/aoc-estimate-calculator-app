import { useEffect, useRef, useState } from 'react';
import { AccessDetailsFields, emptyAccessProfile } from './fields/AccessDetailsFields.jsx';

export function ManualAccessGate({ access }) {
  const [profile, setProfile] = useState(emptyAccessProfile);
  const confirmation = useRef(null);
  const invited = Boolean(access.invitationToken);
  useEffect(() => { if (access.pending) confirmation.current?.focus({ preventScroll: true }); }, [access.pending]);

  async function submit(event) {
    event.preventDefault();
    await access.verify(profile);
  }

  return (
    <div className="access-page">
      <header className="access-header">
        <a className="brand" href="/">Always Open Commerce<span>AI COMMERCE</span></a>
        <span className="access-header-badge"><i /> AOC reviewed access</span>
      </header>
      <main className="access-shell">
        <section className="access-card">
          <div className="access-intro">
            <div className="access-intro__content">
              <div className="access-eyebrow"><span /> AOC ACCESS REQUEST</div>
              <h1>{invited ? 'Your invitation to the AI Commerce estimator' : 'Request access to the AI Commerce estimator'}</h1>
              <p>Tell us about your business. AOC reviews access requests before sharing the calculator.</p>
              <ol className="access-steps" aria-label="Access process">
                <li><span>1</span><div><strong>Submit your details</strong><small>Complete the request form once.</small></div></li>
                <li><span>2</span><div><strong>AOC reviews your request</strong><small>Your request stays pending until a decision is made.</small></div></li>
                <li><span>3</span><div><strong>Use your private access link</strong><small>If approved, AOC sends your link directly.</small></div></li>
              </ol>
            </div>
            <div className="access-trust" aria-label="Access assurances">
              <span><i>✓</i> Private review</span><span><i>✓</i> Editable calculator answers</span><span><i>✓</i> No marketing</span>
            </div>
          </div>
          <div className="access-form-panel">
            {invited ? (
              <div className="access-form">
                <div className="access-form-heading">
                  <span>PRIVATE INVITATION</span><h2>Open your calculator access</h2>
                  <p>This link works once and expires. You do not need to fill out the request form again.</p>
                </div>
                {access.error && <p className="access-error" role="alert">{access.error}</p>}
                <button type="button" className="primary access-submit" onClick={access.redeemInvitation} disabled={access.working || !access.configured}>
                  {access.working ? 'Checking access…' : 'Open calculator'}
                </button>
                <button type="button" onClick={access.resetRequest} disabled={access.working}>Back to request form</button>
              </div>
            ) : access.pending ? (
              <div className="access-form">
                <div role="status" aria-live="polite">
                  <h2 tabIndex={-1} ref={confirmation}>Request received</h2>
                  <p>Your details have been saved. Your request is awaiting AOC review.</p>
                  <p>If approved, AOC will contact you with a private access link. No need to submit the form again.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="access-form-heading">
                  <span>REQUEST CALCULATOR ACCESS</span><h2>Your business details</h2>
                  <p>Submitting this form requests access. It does not automatically open the calculator.</p>
                </div>
                <form className="access-form" onSubmit={submit}>
                  <AccessDetailsFields profile={profile} onChange={setProfile} review />
                  {access.error && <p className="access-error" role="alert">{access.error}</p>}
                  <button type="submit" className="primary access-submit" disabled={access.working || !access.configured}>
                    {access.working ? 'Submitting request…' : 'Request access'}
                  </button>
                </form>
              </>
            )}
            <div className="access-privacy">
              <span className="access-privacy__icon" aria-hidden="true">✓</span>
              <div><strong>Access and privacy</strong>
                <p>Your name, company, website, role and business email are saved privately for access review. No reusable calculator profile, marketing signup, LinkedIn access or email-inbox access is requested.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
