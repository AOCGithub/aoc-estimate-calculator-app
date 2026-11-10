const labels = { name: 'Name', company: 'Company', website: 'Website', role: 'Role', businessEmail: 'Business email' };

export function ClientProfileReview({ profiles, onReuse }) {
  if (!profiles.enabled || (!profiles.saved && !profiles.preview && !profiles.message && !profiles.error)) return null;
  return <div className="client-profile-review">
    <p className="client-profile-trial">Optional company profile · this browser</p>
    {profiles.saved && !profiles.preview && <div className="client-profile-actions">
      <button type="button" disabled={profiles.working} onClick={profiles.review}>Review saved details</button>
      <button type="button" className="quiet" disabled={profiles.working} onClick={profiles.forget}>Forget saved details</button>
    </div>}
    {profiles.preview && <div>
      <h3>Review before reusing</h3>
      <p>Use the business details that still apply. Any details already entered in the form will be kept.</p>
      <dl>{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{profiles.preview.profile[key]}</dd></div>)}</dl>
      <div className="client-profile-actions">
        <button type="button" disabled={profiles.working} onClick={onReuse}>Use these details</button>
        <button type="button" className="quiet" disabled={profiles.working} onClick={profiles.cancelReview}>Cancel</button>
        <button type="button" className="quiet" disabled={profiles.working} onClick={profiles.forget}>Forget saved details</button>
      </div>
    </div>}
    {profiles.message && <p role="status">{profiles.message}</p>}
    {profiles.error && <p className="access-error" role="alert">{profiles.error}</p>}
  </div>;
}
