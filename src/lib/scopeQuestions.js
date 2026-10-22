import { estimatorBank } from './domain.js';

// Only optional category-bank questions; shared calculator inputs live in their own sections.
export function scopeQuestions(area) {
  const sharedIds = new Set([
    ...estimatorBank.appFields,
    ...estimatorBank.dataFields,
    ...estimatorBank.roiFields,
    ...estimatorBank.serviceFields,
  ].map((field) => field.id));
  return (area?.fields || []).filter((field) => field.id !== 'generic' && !sharedIds.has(field.id));
}
