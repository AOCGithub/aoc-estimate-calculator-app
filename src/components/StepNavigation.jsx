import { sectionTitles } from '../constants.js';

export function StepNavigation({ currentStep, hasArea, onNavigate }) {
  return (
    <nav id="sections" aria-label="Calculator sections">
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
