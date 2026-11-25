const bank = globalThis.AOCBank;
const engine = globalThis.AOCJourneyEngine;
const pricing = globalThis.AOCPricing;

if (!bank || !engine || !pricing?.simplified) {
  throw new Error('The estimator rules could not be loaded.');
}

export const estimatorBank = bank;
export const calculateEstimate = engine.calculate;
export const simplifiedRules = pricing.simplified;
