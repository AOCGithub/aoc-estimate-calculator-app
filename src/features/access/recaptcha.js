const failure = 'The security check could not load. Your details are still here; please try again.';
let loading;

export function loadRecaptcha(siteKey, version = 'v3') {
  if (loading) return loading;
  const method = version === 'v2' ? 'render' : 'execute';
  if (window.grecaptcha?.[method]) return Promise.resolve(window.grecaptcha);
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'aoc-recaptcha-script';
    script.src = version === 'v2'
      ? 'https://www.google.com/recaptcha/api.js?onload=aocRecaptchaReady&render=explicit'
      : 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
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
    if (version === 'v2') {
      window.aocRecaptchaReady = () => finish(window.grecaptcha?.render ? window.grecaptcha : null);
    }
    script.onload = () => {
      if (version === 'v2') return;
      // api.js first installs ready(); execute() arrives with its asynchronous runtime.
      if (!window.grecaptcha?.ready) return finish();
      window.grecaptcha.ready(() => finish(window.grecaptcha?.execute ? window.grecaptcha : null));
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
