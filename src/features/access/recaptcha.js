const failure = 'The security check could not load. Your details are still here; please try again.';
let loading;

export function loadRecaptcha(siteKey) {
  if (loading) return loading;
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'aoc-recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
    script.async = true;
    let settled = false;
    const timer = window.setTimeout(() => finish(), 12000);
    function finish(api) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (api) resolve(api);
      else { script.remove(); loading = null; reject(new Error(failure)); }
    }
    script.onerror = () => finish();
    script.onload = () => {
      if (!window.grecaptcha?.ready || !window.grecaptcha?.execute) return finish();
      window.grecaptcha.ready(() => finish(window.grecaptcha));
    };
    document.head.append(script);
  });
  return loading;
}

export async function recaptchaToken(config) {
  if (!config?.enabled) return null;
  if (!config.configured || !config.siteKey) throw new Error(failure);
  const api = await loadRecaptcha(config.siteKey);
  let timer;
  try {
    const token = await Promise.race([
      api.execute(config.siteKey, { action: config.action }),
      new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(failure)), 12000); }),
    ]);
    if (typeof token !== 'string' || !token) throw new Error(failure);
    return token;
  } catch { throw new Error(failure); }
  finally { window.clearTimeout(timer); }
}
