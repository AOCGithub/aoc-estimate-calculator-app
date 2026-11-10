import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRecaptcha, recaptchaToken } from './recaptcha.js';

const buildGateEnabled = import.meta.env.VITE_AOC_ACCESS_GATE_ENABLED === 'true'
  || document.querySelector('meta[name="aoc-access-gate"][content="enabled"]') !== null;

// Keep invite secrets out of copied URLs, referrers, analytics and browser storage.
function takeInvitationFromAddress() {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  if (!parameters.has('access')) return null;
  const token = parameters.get('access') || '';
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return token;
}
const initialInvitation = takeInvitationFromAddress() || '';

export function useAccessGate() {
  const [state, setState] = useState({
    enabled: buildGateEnabled,
    configured: !buildGateEnabled,
    loading: buildGateEnabled,
    authenticated: !buildGateEnabled,
    error: '',
    working: false,
    requestsEnabled: false,
    pending: false,
    manualApproval: false,
    intakeOnly: false,
    recordsEnabled: false,
    profilesEnabled: false,
    savingAvailable: false,
    saveData: false,
    currentProfile: null,
    recaptcha: null,
    captchaToken: '',
    captchaReset: 0,
    checkingCaptcha: false,
    invitationToken: initialInvitation,
  });

  useEffect(() => {
    // A second invitation may navigate only the URL fragment, without reloading React.
    const receiveInvitation = () => {
      const token = takeInvitationFromAddress();
      if (token !== null) setState(current => ({ ...current, invitationToken: token, pending: false, error: '' }));
    };
    window.addEventListener('hashchange', receiveInvitation);
    return () => window.removeEventListener('hashchange', receiveInvitation);
  }, []);

  useEffect(() => {
    if (!buildGateEnabled) return undefined;
    const controller = new AbortController();
    fetch('/api/access/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setState(current => ({ ...current, manualApproval: Boolean(data.manualApproval), configured: false }));
          throw new Error(data.error || 'Access status is unavailable.');
        }
        setState(current => ({
          ...current,
          enabled: Boolean(data.enabled),
          configured: Boolean(data.configured),
          authenticated: Boolean(data.authenticated),
          requestsEnabled: Boolean(data.requestsEnabled),
          manualApproval: Boolean(data.manualApproval),
          intakeOnly: Boolean(data.intakeOnly),
          recordsEnabled: Boolean(data.recordsEnabled),
          profilesEnabled: Boolean(data.profilesEnabled),
          savingAvailable: Boolean(data.savingAvailable),
          saveData: data.saveData === true,
          recaptcha: data.recaptcha || null,
          loading: false,
          error: data.enabled && !data.configured ? 'Calculator access is not configured yet.' : '',
        }));
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        setState(current => ({
          ...current,
          loading: false,
          authenticated: false,
          error: 'Calculator access is temporarily unavailable. Please try again later.',
        }));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.recaptcha?.configured && state.recaptcha.version !== 'v2' && !state.authenticated && !state.loading) {
      loadRecaptcha(state.recaptcha.siteKey).catch(() => {});
    }
  }, [state.recaptcha, state.authenticated, state.loading]);

  const setCaptchaToken = useCallback(token => {
    setState(current => ({ ...current, captchaToken: typeof token === 'string' ? token : '', ...(token ? { error: '' } : {}) }));
  }, []);

  const verify = useCallback(async (profile, afterVerification) => {
    setState(current => ({ ...current, working: true, checkingCaptcha: Boolean(current.recaptcha?.enabled), error: '', pending: false }));
    try {
      const checkbox = state.recaptcha?.enabled && state.recaptcha.version === 'v2';
      if (checkbox && !state.captchaToken) throw new Error('Please complete the “I’m not a robot” checkbox before continuing.');
      const token = checkbox ? state.captchaToken : await recaptchaToken(state.recaptcha);
      setState(current => ({ ...current, checkingCaptcha: false }));
      const response = await fetch('/api/access/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...profile, ...(token ? { captchaToken: token } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 202 && data.pending === true && data.authenticated === false) {
        setState(current => ({ ...current, working: false, pending: true, authenticated: false, error: '' }));
        return { ok: true, pending: true };
      }
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'Access could not be verified.');
      if (afterVerification && !await afterVerification()) {
        setState(current => ({ ...current, working: false }));
        return { ok: false };
      }
      setState(current => ({
        ...current,
        authenticated: true,
        configured: true,
        working: false,
        error: '',
        pending: false,
        invitationToken: '',
        saveData: data.saveData === true,
        currentProfile: Object.fromEntries(['name', 'company', 'website', 'role', 'businessEmail'].map(key => [key, profile[key]])),
      }));
      return { ok: true };
    } catch (error) {
      setState(current => ({ ...current, working: false, checkingCaptcha: false, error: error.message }));
      return { ok: false, message: error.message };
    } finally {
      if (state.recaptcha?.version === 'v2' && state.captchaToken) {
        setState(current => ({ ...current, captchaToken: '', captchaReset: current.captchaReset + 1 }));
      }
    }
  }, [state.recaptcha, state.captchaToken]);

  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/access/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Could not end this session. Please try again.');
      setState(current => ({
        ...current,
        authenticated: false,
        saveData: false,
        currentProfile: null,
        error: '',
        working: false,
        pending: false,
        invitationToken: '',
        captchaToken: '',
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }, []);

  const resetRequest = useCallback(() => {
    setState(current => ({ ...current, pending: false, invitationToken: '', error: '' }));
  }, []);

  const redeemInvitation = useCallback(async () => {
    setState(current => ({ ...current, working: true, error: '' }));
    try {
      const response = await fetch('/api/access/redeem', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: state.invitationToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.authenticated !== true) throw new Error(data.error || 'This access link could not be checked.');
      setState(current => ({ ...current, authenticated: true, working: false, invitationToken: '', pending: false, error: '' }));
      return { ok: true };
    } catch (error) {
      setState(current => ({ ...current, working: false, authenticated: false, error: error.message }));
      return { ok: false, message: error.message };
    }
  }, [state.invitationToken]);

  return useMemo(() => ({
    ...state,
    verify,
    logout,
    resetRequest,
    redeemInvitation,
    setCaptchaToken,
  }), [logout, redeemInvitation, resetRequest, setCaptchaToken, state, verify]);
}
