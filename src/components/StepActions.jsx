export function StepActions({ step, hasArea, onBack, onNext, onCalculate, calculating = false }) {
  return (
    <div className="actions">
      {step > 1 && <button type="button" onClick={onBack}>← Back</button>}
      {step < 7 ? (
        <button
          type="button"
          className="primary"
          disabled={step === 1 && !hasArea}
          onClick={onNext}
        >
          {step === 1 ? 'Describe the work' : 'Continue'} →
        </button>
      ) : (
        <button type="button" className="primary" onClick={onCalculate} disabled={calculating}>
          {calculating ? 'Calculating…' : 'Confirm details & calculate →'}
        </button>
      )}
    </div>
  );
}
