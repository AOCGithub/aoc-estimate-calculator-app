import { useEffect, useRef, useState } from 'react';
import { identityKeys, sameProfileOwner } from '../../../shared/client-profile.mjs';

export function useClientProfile(intakeOnly, profilesEnabled) {
  const enabled = intakeOnly && profilesEnabled;
  const mounted = useRef(false);
  const [state, setState] = useState({ available: false, saved: false, revision: null, retentionDays: 30, working: false, preview: null, error: '', message: '' });
  const requestSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (enabled) fetch('/api/client-profile/status', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        if (!controller.signal.aborted) setState(current => ({ ...current, available: data.available === true, saved: data.saved === true, revision: data.revision || null, retentionDays: data.retentionDays || 30 }));
      }).catch(() => {
        if (!controller.signal.aborted) setState(current => ({ ...current, error: 'Profile saving is unavailable. You can continue without it.' }));
      });
    return () => { mounted.current = false; controller.abort(); };
  }, [enabled]);

  async function request(method, body) {
    const sequence = ++requestSequence.current;
    setState(current => ({ ...current, working: true, error: '', message: '' }));
    try {
      const response = await fetch('/api/client-profile', { method, credentials: 'same-origin',
        ...(method === 'DELETE' ? { headers: { 'If-Match': state.revision || '' } } : {}),
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Saved details are unavailable.');
      if (!mounted.current || sequence !== requestSequence.current) return null;
      setState(current => ({ ...current, working: false }));
      return data;
    } catch (error) {
      if (mounted.current && sequence === requestSequence.current) setState(current => ({ ...current, working: false, error: error.message }));
      return null;
    }
  }
  async function review() {
    const data = await read();
    if (data) setState(current => ({ ...current, preview: data, message: '' }));
  }
  async function read() {
    const data = await request('GET');
    if (data) setState(current => ({ ...current, revision: data.revision }));
    return data;
  }
  function reuse(profile) {
    const details = state.preview?.profile;
    if (!details) return null;
    const entered = { ...details, ...Object.fromEntries(identityKeys.filter(key => profile[key].trim()).map(key => [key, profile[key]])) };
    if (!sameProfileOwner(entered, details)) {
      setState(current => ({ ...current, error: 'The saved profile has different identity or company details. Keep your current details, or clear the conflicting fields before using this profile.' }));
      return null;
    }
    const filled = Object.fromEntries(Object.keys(profile).map(key => [key, profile[key].trim() ? profile[key] : details[key] || '']));
    setState(current => ({ ...current, preview: null, error: '', message: 'Saved details reviewed. Empty fields were filled; any details you already entered were kept.' }));
    return filled;
  }
  async function save(profile, reuseConfirmed, options = {}) {
    if (!enabled || !state.available) return false;
    const data = await request('POST', { profile, consent: true, confirmed: true, reuseConfirmed,
      expectedRevision: state.revision, ...options });
    if (data) setState(current => ({ ...current, saved: true, revision: data.revision, preview: null }));
    return Boolean(data?.saved);
  }
  async function forget() {
    if (!await request('DELETE')) return false;
    setState(current => ({ ...current, saved: false, revision: null, preview: null, message: 'Saved profile removed. You can still edit the details in this form.' }));
    return true;
  }
  return { ...state, enabled: enabled && state.available, review, read, reuse, save, forget,
    cancelReview: () => setState(current => ({ ...current, preview: null, error: '' })) };
}
