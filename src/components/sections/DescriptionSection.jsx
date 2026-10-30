import { useEffect, useRef, useState } from 'react';
import { useLiveDictation } from '../../hooks/useLiveDictation.js';
import { useDescriptionCorrection } from '../../hooks/useDescriptionCorrection.js';
import { VoiceInput } from '../VoiceInput.jsx';

const organizingMessages = [
  'Reading the work and outcome you described.',
  'Matching the details to relevant questions.',
  'Preparing editable answers for your review.',
  'Finishing the suggested form details.',
];

export function DescriptionSection({ state, area, onDescriptionChange, onOrganize, onContinue }) {
  const [organizingStage, setOrganizingStage] = useState(0);
  const [composing, setComposing] = useState(false);
  const textareaRef = useRef(null);
  const voice = useLiveDictation({ description: state.description, area: state.area, onChange: onDescriptionChange });
  const busy = state.working || voice.active;
  const correction = useDescriptionCorrection({ description: state.description, area: state.area,
    blocked: busy || composing, onChange: onDescriptionChange, textareaRef });

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
        ref={textareaRef}
        maxLength="18000"
        spellCheck
        autoCorrect="on"
        autoCapitalize="sentences"
        placeholder={area.prompt}
        value={state.description}
        readOnly={busy}
        aria-describedby={state.working ? 'organizing-status' : 'voice-help'}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
      />
      {correction.ready && <div className="description-correction">
        <label className="correction-toggle"><input type="checkbox" checked={correction.enabled} disabled={busy}
          onChange={event => correction.toggle(event.target.checked)} /> Auto-correct spelling</label>
        <small>OpenAI checks spelling after you pause or stop speaking. Unclear wording needs your review.</small>
        <div className="helper" role="status">{correction.checking ? 'Checking spelling…' : correction.message}
          {correction.canUndo && <button type="button" className="correction-undo" disabled={busy} onClick={correction.undo}>Undo correction</button>}
        </div>
        {correction.review.map((item, index) => <p className="helper" key={index}>Please check “{item.before}” — possibly “{item.after}”. Edit the description to confirm.</p>)}
      </div>}
      <VoiceInput voice={voice} disabled={state.working || (!voice.active && state.description.length >= 18000)} />
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
          disabled={busy}
          aria-busy={state.working}
          onClick={onOrganize}
        >
          {state.working ? 'Organizing…' : 'Organize my description →'}
        </button>
        <button type="button" disabled={busy} onClick={onContinue}>Continue with editable fields</button>
      </div>
      <p className={`helper ${state.analysisError ? 'error' : ''}`} role="status">
        {state.analysisError || (state.analysis
          ? 'Your previous analysis is loaded. Reorganize after changing your explanation.'
          : 'We’ll prefill the details across Sections 3–7. You check them before calculation.')}
      </p>
    </>
  );
}
