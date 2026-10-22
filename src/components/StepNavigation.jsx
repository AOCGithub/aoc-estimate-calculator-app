import { sectionTitles } from '../constants.js';

export function StepNavigation({ currentStep, hasArea, onNavigate }) {
  return (
    <nav id="sections" aria-label="Calculator sections">
      <div className="section-picker">
        <label htmlFor="section-picker">Section {currentStep} of {sectionTitles.length}</label>
        <select
          id="section-picker"
          value={currentStep}
          onChange={(event) => onNavigate(Number(event.target.value))}
        >
          {sectionTitles.map((title, index) => (
            <option key={title} value={index + 1} disabled={index > 0 && !hasArea}>
              {index + 1}. {title}
            </option>
          ))}
        </select>
      </div>
      {sectionTitles.map((title, index) => {
        const step = index + 1;
        return (
          <button
            key={title}
            type="button"
            className={currentStep === step ? 'active' : ''}
            disabled={index > 0 && !hasArea}
            aria-current={currentStep === step ? 'step' : undefined}
            onClick={() => onNavigate(step)}
          >
            <span>{step}</span>
            <span>{title}</span>
          </button>
        );
      })}
    </nav>
  );
}
