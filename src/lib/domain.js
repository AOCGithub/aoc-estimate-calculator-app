const bank = globalThis.AOCBank;
const engine = globalThis.AOCJourneyEngine;

if (!bank || !engine) {
  throw new Error('The estimator rules could not be loaded.');
}

export const estimatorBank = bank;
export const calculateEstimate = engine.calculate;
