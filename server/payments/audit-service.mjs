import Pricing from '../../public/approved-pricing.js';

// Current Agreement sections 3–4 and the framework's approved one-off rules:
// https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit
// Customer wording only: this does not approve a quote or automate fulfilment,
// audit-credit redemption, refunds, delivery dates or client communications.
export const auditService = {
  version: '2026-11-27-template-v6-v3',
  name: Pricing.simplified.paidServiceName,
  description: 'This paid design service examines your current process, identifies efficiency and cost-saving opportunities, and proposes an optimized workflow and phased solution plan. You’ll receive findings, recommendations, solution design and an implementation roadmap. This is design only: no build, configuration, testing or activation. Implementation is quoted and approved separately.',
  included: [
    'Current-process review, findings, feasibility, risks and practical recommendations.',
    'Proposed workflow diagram, phased project scope, dependencies and responsibilities.',
    'Likely software needs and estimated usage where supportable; a separate implementation scope and quotation if sufficiently defined.',
  ],
  excluded: 'The build, ongoing services, software and platform costs, and ad spend are priced separately.',
  delivery: 'We aim to deliver the Discovery & Implementation Plan within 5 business days after we confirm we have everything we need, unless we agree on a different timeline.',
  credit: `If you go ahead with a separately quoted implementation, we’ll credit the eligible design-service fee once against that price, provided you accept the implementation quotation and make its first required payment within ${Pricing.commercial.auditCreditDays} calendar days after we send your approved Optimization & Solution Design Report. Your quotation will show the credit and expiry date. There’s no obligation to proceed.`,
  refund: 'If we can’t confirm and deliver a workable approach for the work covered by your Discovery & Implementation Plan purchase, we’ll refund the fee in full.',
  purchaseAgreement: {
    version: '2026-11-27-template-v6-purchase-v3',
    text: `I have reviewed the paid discovery scope, one-time fee, delivery, credit and refund terms, and agree to purchase the ${Pricing.simplified.paidServiceName}. Implementation and ongoing services are separate.`,
  },
};
