// Keep approved rules unchanged and load them only when the calculator is opened.
let loading;

function loadScript(path, ready) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => finish(false), 15000);
    function finish(ok) {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (ok) resolve();
      else { script.remove(); reject(new Error('The estimator rules could not load.')); }
    }
    script.src = path;
    script.onload = () => finish(Boolean(ready()));
    script.onerror = () => finish(false);
    document.head.append(script);
  });
}

export function loadEstimatorRules() {
  if (!loading) {
    loading = Promise.all([
      loadScript('/engine.js', () => globalThis.AOC),
      loadScript('/approved-bank.js', () => globalThis.AOCBank),
      loadScript('/approved-pricing.js', () => globalThis.AOCPricing),
      loadScript('/commercial.js', () => globalThis.AOCCommercial),
    ]).then(() => loadScript('/journey-engine.js', () => globalThis.AOCJourneyEngine));
  }
  return loading;
}
