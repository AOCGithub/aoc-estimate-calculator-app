import { useCallback, useEffect, useRef, useState } from 'react';
import { createLiveTranscript } from '../lib/liveTranscript.mjs';

function release(session) {
  session.controller.abort();
  clearInterval(session.clock);
  clearTimeout(session.connectTimeout);
  clearTimeout(session.prepareTimeout);
  clearTimeout(session.commitTimeout);
  clearTimeout(session.finalTimeout);
  session.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
  if (session.channel) { session.channel.onopen = null; session.channel.onmessage = null; session.channel.onclose = null; session.channel.close(); }
  if (session.peer) { session.peer.onconnectionstatechange = null; session.peer.close(); }
}

export function useLiveDictation({ description, area, onChange }) {
  const latest = useRef({ description, area, onChange });
  latest.current = { description, area, onChange };
  const current = useRef(null);
  const [status, setStatus] = useState({ ready: false, phase: 'idle', seconds: 0, error: '', notice: '' });
  const secure = window.isSecureContext;
  const supported = Boolean(secure && navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);

  const finish = useCallback((notice = '', error = '') => {
    const session = current.current;
    if (!session) return;
    current.current = null;
    release(session);
    setStatus(state => ({ ...state, phase: 'idle', notice, error }));
  }, []);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    if (supported) fetch('/api/voice/session', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!disposed) setStatus(state => ({ ...state, ready: response.ok && data.enabled && data.configured }));
      }).catch(() => { /* Typing remains available when voice is unconfigured/offline. */ });
    const leave = () => {
      if (document.hidden) finish('Voice stopped when you left this tab. Captured text is kept.');
    };
    document.addEventListener('visibilitychange', leave);
    return () => {
      disposed = true;
      controller.abort();
      document.removeEventListener('visibilitychange', leave);
      const session = current.current;
      current.current = null;
      if (session) release(session);
    };
  }, [finish, supported]);

  function stop(notice = '') {
    const session = current.current;
    if (!session) return;
    if (session.phase !== 'listening') {
      finish(session.phase === 'finishing' ? 'Captured text kept. Review the last words before continuing.' : 'Voice cancelled. Captured text is kept.');
      return;
    }
    session.phase = 'finishing';
    session.notice = notice;
    clearInterval(session.clock);
    // Stop the microphone immediately; leave the data channel open for final corrections.
    session.stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
    setStatus(state => ({ ...state, phase: 'finishing', notice }));
    session.commitTimeout = setTimeout(() => {
      if (current.current !== session) return;
      if (session.channel.readyState !== 'open') return finish('Captured text kept. Review the last words before continuing.');
      session.channel.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }, 250);
    session.finalTimeout = setTimeout(() => {
      if (current.current === session) finish('Final confirmation timed out. Captured text is kept; please review it.');
    }, 12000);
  }

  async function start() {
    if (current.current || !supported || !status.ready || latest.current.description.length >= 18000) return;
    const session = { controller: new AbortController(), phase: 'connecting', transcript: createLiveTranscript(latest.current.description) };
    current.current = session;
    setStatus(state => ({ ...state, phase: 'connecting', seconds: 0, error: '', notice: '' }));
    session.connectTimeout = setTimeout(() => {
      if (current.current === session) finish('', 'Voice could not connect. Your description is preserved; retry or type.');
    }, 35000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (current.current !== session) { stream.getTracks().forEach(track => track.stop()); return; }
      session.stream = stream;
      const tracks = stream.getAudioTracks();
      if (!tracks.length) throw new Error('no_microphone');
      tracks.forEach(track => { track.enabled = false; });
      const peer = new RTCPeerConnection();
      session.peer = peer;
      tracks.forEach(track => {
        peer.addTrack(track, stream);
        track.onended = () => finish('Microphone stopped. Captured text is kept.');
      });
      const channel = peer.createDataChannel('oai-events');
      session.channel = channel;
      // Session metadata can arrive before the media transport is fully connected.
      // Enable audio first, then leave a short settling period before inviting speech.
      function prepareMicrophone() {
        if (current.current !== session || session.phase !== 'connecting' || !session.verified || !session.remoteReady
          || peer.connectionState !== 'connected' || channel.readyState !== 'open') return;
        session.phase = 'preparing';
        tracks.forEach(track => { track.enabled = true; });
        setStatus(state => ({ ...state, phase: 'preparing' }));
        session.prepareTimeout = setTimeout(() => {
          if (current.current !== session || session.phase !== 'preparing') return;
          clearTimeout(session.connectTimeout);
          session.phase = 'listening';
          session.started = Date.now();
          setStatus(state => ({ ...state, phase: 'listening' }));
          session.clock = setInterval(() => {
            if (current.current !== session) return;
            const seconds = Math.floor((Date.now() - session.started) / 1000);
            setStatus(state => ({ ...state, seconds }));
            if (seconds >= 120) stop('Two-minute recording limit reached. You can start again to add more.');
          }, 1000);
        }, 400);
      }
      channel.onopen = prepareMicrophone;
      peer.onconnectionstatechange = () => {
        if (current.current === session && ['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
          finish('', 'Voice connection lost. Captured text is kept; you can type or retry.');
        }
        prepareMicrophone();
      };
      channel.onclose = () => {
        if (current.current === session) finish('Voice disconnected. Captured text is kept.');
      };
      channel.onmessage = message => {
        if (current.current !== session) return;
        let event;
        try { event = JSON.parse(message.data); } catch { return; }
        if (event.type === 'session.created' || event.type === 'transcription_session.created') {
          if (session.phase !== 'connecting' || session.verified) return;
          if (event.session?.type !== 'transcription') return finish('', 'Voice session could not be verified. Please type or retry.');
          session.verified = true;
          prepareMicrophone();
        }
        if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
          return finish('', 'Voice could not finish this speech. Captured text is kept; please review or type.');
        }
        if (['input_audio_buffer.committed', 'conversation.item.input_audio_transcription.delta', 'conversation.item.input_audio_transcription.completed'].includes(event.type)) {
          session.transcript.update(event);
          latest.current.onChange(session.transcript.text());
          if (event.type === 'input_audio_buffer.committed') session.finalItem = event.item_id;
          if (session.phase === 'finishing' && session.finalItem && session.transcript.completed(session.finalItem)) {
            finish(session.notice || 'Voice stopped. Review names, numbers and unclear wording before organizing.');
          } else if (session.phase === 'listening' && session.transcript.text().length >= 18000) stop('Description limit reached. Review or shorten the captured text.');
        }
      };
      const offer = await peer.createOffer();
      if (current.current !== session) return;
      await peer.setLocalDescription(offer);
      const response = await fetch('/api/voice/session', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: latest.current.area, sdp: peer.localDescription.sdp }), signal: session.controller.signal,
      });
      const data = await response.json();
      if (current.current !== session) return;
      if (!response.ok || typeof data.sdp !== 'string') {
        const error = new Error('connection_failed');
        error.voiceMessage = typeof data.error === 'string' ? data.error : '';
        throw error;
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      session.remoteReady = true;
      prepareMicrophone();
    } catch (error) {
      if (current.current !== session) return;
      const denied = ['NotAllowedError', 'SecurityError'].includes(error.name);
      finish('', denied ? 'Microphone permission was denied. Allow it in your browser or type your description.'
        : error.voiceMessage || 'Could not start live voice. Your description is preserved; check your microphone or try again.');
    }
  }

  return { ...status, secure, supported, active: status.phase !== 'idle', start, stop };
}
