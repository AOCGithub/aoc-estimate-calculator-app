import { useCallback, useEffect, useMemo, useState } from 'react';

const buildGateEnabled = import.meta.env.VITE_AOC_ACCESS_GATE_ENABLED === 'true'
  || document.querySelector('meta[name="aoc-access-gate"][content="enabled"]') !== null;

export function useAccessGate() {
  const [state, setState] = useState({
    enabled: buildGateEnabled,
    configured: !buildGateEnabled,
    loading: buildGateEnabled,
    authenticated: !buildGateEnabled,
    error: '',
    working: false,
  });

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
        if (!response.ok) throw new Error(data.error || 'Access status is unavailable.');
        setState(current => ({
          ...current,
          enabled: Boolean(data.enabled),
          configured: Boolean(data.configured),
          authenticated: Boolean(data.authenticated),
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
    setState(current => ({ ...current, working: true, error: '' }));
    try {
      const response = await fetch('/api/access/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.authenticated) throw new Error(data.error || 'Access could not be verified.');
      setState(current => ({
        ...current,
        authenticated: true,
        configured: true,
        working: false,
        error: '',
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
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }, []);

  return useMemo(() => ({
    ...state,
    verify,
    logout,
  }), [logout, state, verify]);
}
