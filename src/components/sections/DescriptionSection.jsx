import { useEffect, useState } from 'react';

const organizingMessages = [
  'Reading the work and outcome you described.',
  'Matching the details to relevant questions.',
  'Preparing editable answers for your review.',
  'Finishing the suggested form details.',
];

export function DescriptionSection({ state, area, onDescriptionChange, onOrganize, onContinue }) {
  const [organizingStage, setOrganizingStage] = useState(0);

  useEffect(() => {
    if (!state.working) {
      setOrganizingStage(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setOrganizingStage((current) => Math.min(current + 1, organizingMessages.length - 1));
    }, 1800);
    return () => window.clearInterval(interval);
  }, [state.working]);

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
        readOnly={state.working}
        aria-describedby={state.working ? 'organizing-status' : undefined}
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
      {state.working && (
        <div
          id="organizing-status"
          className="organizing-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="organizing-status__spinner" aria-hidden="true" />
          <div>
            <strong>Organizing your description…</strong>
            <p key={organizingStage} className="organizing-status__message">
              {organizingMessages[organizingStage]}
            </p>
            <small>Your description is preserved while the editable answers are prepared.</small>
          </div>
        </div>
      )}
      <div className="actions description-actions">
        <button
          type="button"
          className="primary"
          disabled={state.working}
          aria-busy={state.working}
          onClick={onOrganize}
        >
          {state.working ? 'Organizing…' : 'Organize my description →'}
        </button>
        <button type="button" disabled={state.working} onClick={onContinue}>Continue with editable fields</button>
      </div>
      <p className={`helper ${state.analysisError ? 'error' : ''}`} role="status">
        {state.analysisError || (state.analysis
          ? 'Your previous analysis is loaded. Reorganize after changing your explanation.'
          : 'We’ll prefill the details across Sections 3–7. You check them before calculation.')}
      </p>
    </>
  );
}
