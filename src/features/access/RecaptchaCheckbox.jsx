import { useEffect, useRef, useState } from 'react';
import { loadRecaptcha } from './recaptcha.js';

export function RecaptchaCheckbox({ access }) {
  const host = useRef(null);
  const widget = useRef(null);
  const [size, setSize] = useState('compact');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const config = access.recaptcha;
  const enabled = config?.enabled && config.version === 'v2';

  useEffect(() => {
    if (!enabled || !host.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect.width < 304 ? 'compact' : 'normal'));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !config.configured || !host.current) return undefined;
    let active = true;
    let rendered;
    const container = document.createElement('div');
    host.current.replaceChildren(container);
    access.setCaptchaToken('');
    setLoading(true);
    setError('');
    loadRecaptcha(config.siteKey, 'v2').then(api => {
      if (!active) return;
      const id = api.render(container, {
        sitekey: config.siteKey, size, theme: 'light',
        callback: token => {
          if (!active) return;
          access.setCaptchaToken(token);
          setError('');
        },
        'expired-callback': () => {
          if (!active) return;
          access.setCaptchaToken('');
          setError('The security check expired. Please tick the checkbox again.');
          api.reset(id);
        },
        'error-callback': () => {
          if (!active) return;
          access.setCaptchaToken('');
          setError('The security check could not connect. Please retry.');
        },
      });
      rendered = { api, id };
      widget.current = rendered;
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setError('The security check could not load. Your details are still here; please retry.');
    });
    return () => {
      active = false;
      if (rendered) {
        try { rendered.api.reset(rendered.id); } catch { /* The provider may already have removed the frame. */ }
      }
      if (widget.current === rendered) widget.current = null;
      container.remove();
    };
  }, [enabled, config?.configured, config?.siteKey, size, attempt, access.setCaptchaToken]);

  useEffect(() => {
    if (widget.current) {
      try { widget.current.api.reset(widget.current.id); }
      catch { setAttempt(current => current + 1); }
    }
  }, [access.captchaReset]);

  if (!enabled) return null;
  return <div className="recaptcha-checkbox" aria-label="Security check" aria-busy={loading}>
    <div ref={host} className="recaptcha-checkbox__widget" inert={access.working ? true : undefined} />
    {loading && <p role="status">Loading security check…</p>}
    {error && <p className="access-error" role="alert">{error}</p>}
    {error && <button type="button" disabled={access.working} onClick={() => setAttempt(current => current + 1)}>Retry security check</button>}
  </div>;
}
