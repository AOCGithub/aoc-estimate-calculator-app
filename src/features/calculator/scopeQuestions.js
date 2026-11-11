import { estimatorBank } from '../../lib/domain.js';

const sharedIds = new Set([
  ...estimatorBank.appFields,
  ...estimatorBank.dataFields,
  ...estimatorBank.roiFields,
  ...estimatorBank.serviceFields,
].map((field) => field.id));
const questionsByArea = new WeakMap();

// Bank definitions are immutable for the loaded rules version. Reuse their optional questions.
export function scopeQuestions(area) {
  if (!area) return [];
  if (!questionsByArea.has(area)) {
    questionsByArea.set(area, area.fields.filter((field) => field.id !== 'generic' && !sharedIds.has(field.id)));
  }
  return questionsByArea.get(area);
}
