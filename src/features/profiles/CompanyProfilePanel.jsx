import { useState } from 'react';
import { companyFactFields, displayFact, knownCompanyValue, sameProfileOwner } from '../../../shared/client-profile.mjs';
import './CompanyProfilePanel.css';
import { estimatorBank } from '../../lib/domain.js';

export function CompanyProfilePanel({ profiles, identity, state, onApply }) {
  const [snapshot, setSnapshot] = useState(null);
  const [reuse, setReuse] = useState({});
  const [save, setSave] = useState({});
  const [remove, setRemove] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  if (!profiles.enabled) return null;
  const fields = companyFactFields.filter(field => field.step === state.step);
  const saved = fields.filter(field => snapshot?.facts[field.id]);
  const candidates = fields.filter(field => knownCompanyValue(state.answers[field.id]));
  const mismatch = identity && snapshot && !sameProfileOwner(identity, snapshot.profile);
  const busy = profiles.working || state.working || state.calculating;
  const reuseIds = saved.filter(({ id }) => reuse[id] && !Object.hasOwn(state.answers, id) && !state.removedScopeFields.includes(id)).map(field => field.id);
  const saveIds = candidates.filter(field => save[field.id]).map(field => field.id);
  const removeIds = saved.filter(field => remove[field.id]).map(field => field.id);
  const reset = () => { setReuse({}); setSave({}); setRemove({}); setConfirmed(false); setConsent(false); };
  async function review() {
    const data = await profiles.read();
    if (data) { setSnapshot(data); reset(); setMessage(''); }
  }
  async function saveFacts() {
    if (!consent || mismatch || (!saveIds.length && !removeIds.length) || (profiles.saved && !snapshot)) return;
    const facts = Object.fromEntries(saveIds.map(id => [id, { value: state.answers[id], source: {
      kind: state.facts[id] ? 'ai_extracted' : state.profileSources[id] ? 'reviewed_saved_profile' : 'client_entry',
      ...(state.facts[id] ? { quote: state.facts[id] } : {}),
    } }]));
    const savedOk = await profiles.save(snapshot?.profile || identity, Boolean(snapshot), {
      facts, removeIds, area: state.area, description: state.description,
      expectedRevision: snapshot?.revision || profiles.revision,
    });
    if (savedOk) { await review(); setMessage('Company profile updated. Future reuse still requires your confirmation.'); }
  }
  function apply() {
    if (!confirmed || mismatch || !reuseIds.length) return;
    onApply(Object.fromEntries(reuseIds.map(id => [id, snapshot.facts[id]])), snapshot.revision, state.area);
    setReuse({}); setConfirmed(false);
    setMessage('Selected facts applied to empty fields. Review them with this estimate; existing and cleared answers were kept.');
  }
  async function forget() {
    if (await profiles.forget()) { setSnapshot(null); reset(); setMessage(''); }
  }
  return <details className="field-bank compact-details profile-company-panel">
    <summary><span>Company profile</span><span className="disclosure-meta">Optional</span></summary>
    <p>Choose which company facts still apply to this work. Nothing is reused or saved automatically.</p>
    <p className="helper">Saved profiles expire {profiles.retentionDays} days after your latest save. You can remove selected facts or forget the profile at any time. Removing a profile does not delete separately saved estimates.</p>
    {profiles.saved && <div className="profile-company-actions">
      <button type="button" onClick={review} disabled={busy}>Review company profile</button>
      <button type="button" className="quiet" onClick={forget} disabled={busy}>Forget company profile</button>
    </div>}
    {snapshot && <>
      <p className="helper">Saved for <strong>{snapshot.profile.company}</strong> · {snapshot.profile.businessEmail}</p>
      {mismatch ? <p className="profile-company-warning" role="alert">This profile belongs to different client details. It cannot be used for this estimate.</p> : <>
        <h3>Reuse relevant facts</h3>
        {saved.length ? saved.map(({ id, label }) => {
          const protectedAnswer = Object.hasOwn(state.answers, id) || state.removedScopeFields.includes(id);
          const fact = snapshot.facts[id];
          const area = estimatorBank.areas.find(area => area.id === fact.source.area)?.label || 'a previous estimate';
          const source = fact.source.kind === 'ai_extracted' ? 'From a client description' : fact.source.kind === 'reviewed_saved_profile' ? 'Previously confirmed profile' : 'Entered by the client';
          return <label className="profile-company-choice" key={id}>
            <input type="checkbox" checked={Boolean(reuse[id])} disabled={busy || protectedAnswer}
              onChange={event => setReuse(current => ({ ...current, [id]: event.target.checked }))} />
            <span><strong>{label}: {displayFact(fact.value)}</strong>
              <small>{source} · {area} · confirmed {new Date(fact.source.confirmedAt).toLocaleDateString()}. {protectedAnswer ? 'Current answer kept.' : 'Select only if relevant to this work.'}</small>
            </span>
          </label>;
        }) : <p className="helper">No saved facts for this section.</p>}
        <label className="profile-company-choice"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} /><span>I confirm the selected facts belong to this company and still apply to this estimate.</span></label>
        <button type="button" onClick={apply} disabled={busy || !confirmed || !reuseIds.length}>Use selected facts</button>
      </>}
    </>}
    {!mismatch && <>
      <h3>Save selected company facts</h3>
      {candidates.length ? candidates.map(({ id, label }) => <label className="profile-company-choice" key={id}>
        <input type="checkbox" checked={Boolean(save[id])} disabled={busy || Boolean(remove[id])}
          onChange={event => setSave(current => ({ ...current, [id]: event.target.checked }))} />
        <span><strong>{label}: {displayFact(state.answers[id])}</strong>
          {snapshot?.facts[id] && displayFact(snapshot.facts[id].value) !== displayFact(state.answers[id])
            && <small>Replaces saved value: {displayFact(snapshot.facts[id].value)}</small>}
        </span>
      </label>) : <p className="helper">Answer the relevant app or information-location questions to choose facts to save. Unknowns, pricing and process-specific decisions are excluded.</p>}
      {saved.length > 0 && <details><summary>Remove outdated facts</summary>{saved.map(({ id, label }) => <label className="profile-company-choice" key={id}>
        <input type="checkbox" checked={Boolean(remove[id])} disabled={busy || Boolean(save[id])}
          onChange={event => setRemove(current => ({ ...current, [id]: event.target.checked }))} /><span>Remove saved {label.toLowerCase()}</span>
      </label>)}</details>}
      <label className="profile-company-choice"><input type="checkbox" checked={consent} disabled={busy || !profiles.available}
        onChange={event => setConsent(event.target.checked)} /><span>Save the selected company facts and removals to my profile for future estimates (optional).</span></label>
      {profiles.saved && !snapshot && <p className="helper">Review the saved profile before updating it.</p>}
      {!identity && !snapshot && <p className="helper">Enter your business details again to create a profile, or review an existing saved profile.</p>}
      <button type="button" onClick={saveFacts} disabled={busy || !consent || (!saveIds.length && !removeIds.length)
        || (!identity && !snapshot) || (profiles.saved && !snapshot)}>Save selected company facts</button>
    </>}
    {message && <p role="status">{message}</p>}
    {profiles.error && <p className="profile-company-warning" role="alert">{profiles.error}</p>}
  </details>;
}
