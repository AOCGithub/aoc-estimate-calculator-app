// Existing calculator fields that can be relevant company facts. They are never
// reused automatically: the client selects them and confirms their relevance.
export const companyFactFields = [
  { id: 'systems', label: 'Apps and software', step: 4 },
  { id: 'app_status', label: 'App usage status', step: 4 },
  { id: 'app_account_structure', label: 'App account structure', step: 4 },
  { id: 'app_access_owner', label: 'Who manages app access', step: 4 },
  { id: 'app_known_restrictions', label: 'Known connection restrictions', step: 4 },
  { id: 'app_exact_product', label: 'Exact product', step: 4 },
  { id: 'app_version_plan', label: 'Product version or plan', step: 4 },
  { id: 'app_vendor_reference', label: 'Vendor reference', step: 4 },
  { id: 'app_file_transfer', label: 'Existing import/export capabilities', step: 4 },
  { id: 'data_information_location', label: 'Where information is kept', step: 5 },
];
const allowed = new Set(companyFactFields.map(field => field.id));
export const identityKeys = ['name', 'company', 'website', 'businessEmail'];
const normalizeIdentity = value => String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
export const sameProfileOwner = (left, right) => identityKeys.every(key => normalizeIdentity(left?.[key]) === normalizeIdentity(right?.[key]));
export const displayFact = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');
export function knownCompanyValue(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(knownCompanyValue);
  return typeof value === 'string' && value.trim().length > 0
    && !/^(?:not sure|unknown|not provided|not sure\s*\/\s*not provided|help determine)$/i.test(value.trim());
}
export function validateCompanyFacts(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Choose the company facts to save.');
  const result = {};
  for (const [id, item] of Object.entries(input)) {
    if (!allowed.has(id)) throw new Error('Only reusable company facts can be saved in the profile.');
    const value = item?.value;
    if (!knownCompanyValue(value) || (Array.isArray(value) && (id !== 'systems' || value.length > 50))
      || displayFact(value).length > 2000) throw new Error('Review the selected facts; unknown or overly long details cannot be saved.');
    result[id] = { value: Array.isArray(value) ? value.map(text => text.trim()) : value.trim(),
      source: item.source && typeof item.source === 'object' ? item.source : {} };
  }
  return result;
}

// Presence also protects deliberately cleared answers. A saved profile cannot
// reintroduce something the client removed, overwrite fresh AI facts, or set prices.
export function mergeCompanyFacts(state, selected, revision) {
  const answers = { ...state.answers }, profileSources = { ...state.profileSources };
  let count = 0;
  for (const { id } of companyFactFields) {
    const fact = selected[id];
    if (!fact || !knownCompanyValue(fact.value) || Object.hasOwn(answers, id) || state.removedScopeFields.includes(id)) continue;
    answers[id] = structuredClone(fact.value);
    profileSources[id] = { kind: 'reviewed_saved_profile', revision, confirmedAt: Date.now(), original: fact.source };
    count++;
  }
  return { answers, profileSources, count };
}
