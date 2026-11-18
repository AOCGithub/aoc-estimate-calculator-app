import Pricing from '../../public/approved-pricing.js';

// Current Agreement sections 3–4 and the framework's approved one-off rules:
// https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit
// Customer wording only: this does not approve a quote or automate fulfilment,
// audit-credit redemption, refunds, delivery dates or client communications.
export const auditService = {
  version: '2026-11-18-audit-v2',
  name: 'Initial audit & roadmap',
  description: 'We’ll review how your team works today and tell you what’s possible. If we find an approach that works, we’ll give you a plan and a quote for the build.',
  included: [
    'A review of your process, the information you have and the apps we’d need to connect.',
    'A written report explaining what could work, what might get in the way and who would handle each part.',
    'If we find a workable option, a build plan with the proposed steps, what’s included, a quote and estimated running costs.',
  ],
  excluded: 'The build, ongoing services, software and platform costs, and ad spend are priced separately.',
  delivery: 'We aim to deliver the audit within 5 business days after we confirm we have everything we need, unless we agree on a different timeline.',
  credit: `You can put the full audit fee you paid toward the build once. To qualify, accept the build quote and make the required first build payment within ${Pricing.commercial.auditCreditDays} calendar days after we send the approved audit. AOC confirms and applies the credit.`,
  refund: 'If we can’t confirm and deliver a workable approach for the work covered by your audit, we’ll refund the audit fee in full.',
};
