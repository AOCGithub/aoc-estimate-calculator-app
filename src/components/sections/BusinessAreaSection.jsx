import { areaIcons } from '../../constants.js';
import { estimatorBank } from '../../lib/domain.js';

export function BusinessAreaSection({ selectedArea, onChoose }) {
  return (
    <>
      <h2>
        Where should we start?
        {!selectedArea && <span className="required-indicator">Required</span>}
      </h2>
      <p>
        Choose the business area closest to the work. You don’t need to choose between an
        automation and an AI agent.
      </p>
      <div className="areas">
        {estimatorBank.areas.map((area, index) => (
          <button
            key={area.id}
            type="button"
            className={`area ${area.id === selectedArea ? 'selected' : ''}`}
            aria-pressed={area.id === selectedArea}
            onClick={() => onChoose(area.id)}
          >
            <span className="icon" aria-hidden="true">{areaIcons[index]}</span>
            {area.label}
          </button>
        ))}
      </div>
      <p className="helper">Start with one connected process. We can scope the broader business in phases.</p>
    </>
  );
}
