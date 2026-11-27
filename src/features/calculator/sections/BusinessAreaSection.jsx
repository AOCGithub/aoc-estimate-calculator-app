import { Icon } from '../../../components/Icon.jsx';
import { estimatorBank, simplifiedRules } from '../../../lib/domain.js';

const areaIcons = {
  area0: 'finance',
  area1: 'operations',
  area2: 'support',
  area3: 'people',
  area4: 'people',
  area5: 'content',
};

export function BusinessAreaSection({ selectedArea, onChoose }) {
  const activeAreas = simplifiedRules.activeAreaIds
    .map(id => estimatorBank.areas.find(area => area.id === id))
    .filter(Boolean);
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
        {activeAreas.map(area => (
          <button
            key={area.id}
            type="button"
            className={`area ${area.id === selectedArea ? 'selected' : ''}`}
            aria-pressed={area.id === selectedArea}
            onClick={() => onChoose(area.id)}
          >
            <span className="icon" aria-hidden="true"><Icon name={areaIcons[area.id]} /></span>
            <span>{area.label}</span>
            <Icon name="chevron" className="area-arrow" />
          </button>
        ))}
        {simplifiedRules.comingSoonAreas.map(area => (
          <button key={area.id} type="button" className="area area--coming-soon" disabled>
            <span className="icon" aria-hidden="true"><Icon name="clock" /></span>
            <span>{area.label}<small>Coming soon</small></span>
          </button>
        ))}
      </div>
      <p className="helper">Start with one connected process. We can scope broader work in phases.</p>
    </>
  );
}
