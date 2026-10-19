export function DescriptionSection({ state, area, onDescriptionChange, onOrganize, onContinue }) {
  return (
    <>
      <h2>Tell us what you want to improve.</h2>
      <p>{area.prompt}</p>
      <p className="field-help">
        Include apps, people, teams, frequency, volume, rules, exceptions, and the desired outcome when known. Skip anything you do not know.
      </p>
      <label htmlFor="description">What happens today, and what should happen instead?</label>
      <textarea
        id="description"
        maxLength="18000"
        placeholder={area.prompt}
        value={state.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
      />
      <div className="voice">
        <span aria-hidden="true">◉</span>
        <div>
          <strong>Prefer to speak?</strong>
          <small>Voice input is planned. Type or paste your explanation in this review version.</small>
        </div>
        <button type="button" disabled>Voice · planned</button>
      </div>
      <div className="actions">
        <button type="button" className="primary" disabled={state.working} onClick={onOrganize}>
          {state.working ? 'Organizing…' : 'Organize my description →'}
        </button>
        <button type="button" onClick={onContinue}>Continue with editable fields</button>
      </div>
      <p className={`helper ${state.analysisError ? 'error' : ''}`} role="status">
        {state.analysisError || (state.analysis
          ? 'Your previous analysis is loaded. Reorganize after changing your explanation.'
          : 'We’ll prefill the details across Sections 3–7. You check them before calculation.')}
      </p>
    </>
  );
}
