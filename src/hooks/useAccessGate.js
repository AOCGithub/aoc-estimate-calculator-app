import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const verify = useCallback(async (profile) => {
    setState(current => ({ ...current, working: true, error: '', pending: false }));
    try {
      const response = await fetch('/api/access/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 202 && data.pending === true && data.authenticated === false) {
        setState(current => ({ ...current, working: false, pending: true, authenticated: false, error: '' }));
        return { ok: true, pending: true };
      }
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'Access could not be verified.');
      setState(current => ({
        ...current,
        authenticated: true,
        configured: true,
        working: false,
        error: '',
        pending: false,
        invitationToken: '',
      }));
      return { ok: true };
    } catch (error) {
      setState(current => ({ ...current, working: false, error: error.message }));
      return { ok: false, message: error.message };
    }
  }, []);

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
        error: '',
        working: false,
        pending: false,
        invitationToken: '',
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
  }), [logout, redeemInvitation, resetRequest, state, verify]);
}
