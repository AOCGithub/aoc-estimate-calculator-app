import { createHash } from 'node:crypto';
import questionBank from '../../public/approved-bank.js';
import { auditService } from './audit-service.mjs';

export const c10OrderVersion = 'C10-2026-11-27-v2';

const value = input => input == null ? '' : Array.isArray(input) ? input.join(', ') : String(input);
const areaName = id => questionBank.areas.find(area => area.id === id)?.label || id || 'Agreed business process';
const sentences = input => String(input || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]?/g) || [];
const shorten = (input, limit = 92) => {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1).replace(/\s+\S*$/, '').trimEnd();
  return `${cut || text.slice(0, limit - 1)}…`;
};
function agreedGoal(description, area) {
  const explicit = sentences(description).find(sentence =>
    /\b(?:we\s+(?:want|need)|goal|objective|improv(?:e|ing)|reduc(?:e|ing)|increas(?:e|ing)|optim(?:ize|ise|izing|ising)|automat(?:e|ing))\b/i.test(sentence));
  return shorten(explicit?.trim() || `Optimize the agreed ${areaName(area).toLowerCase()} process described in this order.`, 112);
}
function agreedProcess(description, area) {
  const action = sentences(description).find(sentence =>
    /\b(?:process|workflow|prepare|create|send|collect|review|monitor|manage|handle|route|check|report|draft|apply|record|reconcile)\b/i.test(sentence));
  return shorten(action?.trim() || areaName(area));
}

export function createC10OrderDraft(saved, quote) {
  const snapshot = typeof saved.snapshot === 'string' ? JSON.parse(saved.snapshot) : saved.snapshot;
  const service = snapshot.service || auditService;
  const profile = snapshot.profile || {};
  const systems = value(snapshot.answers?.systems) || 'No systems listed in the saved intake';
  const departmentCount = Number(snapshot.answers?.department_count);
  const draft = {
    documentType: 'C10',
    documentTitle: 'Process Optimization & Solution Design Order',
    version: c10OrderVersion,
    reference: `C10-${quote.id}`,
    issuedAt: saved.created_at,
    submissionReference: saved.id,
    recordingReference: saved.recording_reference,
    client: {
      name: profile.name || 'Not provided',
      company: profile.company || 'Not provided',
      businessEmail: profile.businessEmail || 'Not provided',
      website: profile.website || 'Not provided',
      role: profile.role || 'Not provided',
    },
    project: {
      businessArea: areaName(snapshot.area),
      businessGoal: agreedGoal(saved.description, snapshot.area),
      agreedProcess: agreedProcess(saved.description, snapshot.area),
      sourceDescription: saved.description,
      systems,
      departments: Number.isFinite(departmentCount) && departmentCount > 0
        ? `${departmentCount} department${departmentCount === 1 ? '' : 's'}`
        : 'Not provided in the saved intake',
    },
    service: {
      name: service.name,
      description: service.description,
      included: [...service.included],
      excluded: service.excluded,
      delivery: service.delivery,
      credit: service.credit,
      refund: service.refund,
      changeControl: 'Work outside this order requires a separately agreed scope and accepted quote or change order.',
    },
    price: {
      amount: quote.amount,
      currency: quote.currency,
      tax: 'No separate tax amount is added at checkout.',
      total: quote.amount,
    },
    acceptance: {
      agreementVersion: service.purchaseAgreement?.version || auditService.purchaseAgreement.version,
      wording: service.purchaseAgreement?.text || auditService.purchaseAgreement.text,
    },
  };
  return {...draft, fingerprint: createHash('sha256').update(JSON.stringify(draft)).digest('hex')};
}

export function acceptC10Order(draft, acceptedAt) {
  return {...draft, acceptance: {...draft.acceptance, acceptedAt}};
}

export function sameC10Order(left, right) {
  return Boolean(left && right && left.reference === right.reference && left.version === right.version
    && left.fingerprint === right.fingerprint
    && left.submissionReference === right.submissionReference && left.price?.amount === right.price?.amount
    && left.price?.currency === right.price?.currency);
}
