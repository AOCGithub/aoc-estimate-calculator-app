export function VoiceInput({ voice, disabled }) {
  const labels = { idle: 'Start live voice input', connecting: 'Cancel voice connection',
    preparing: 'Cancel voice connection', listening: 'Stop voice input', finishing: 'Keep captured text' };
  const messages = { connecting: 'Connecting your microphone. Wait for Listening before speaking.',
    preparing: 'Preparing your microphone. Please wait for Listening before speaking.',
    listening: 'Listening — you can speak now. Live text is a draft.', finishing: 'Finishing the last words. Your microphone is off.' };
  return (
    <>
      <div className={'voice live-voice' + (voice.phase === 'listening' ? ' live-voice--listening' : '')}>
        <svg className="voice-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
        </svg>
        <div className="live-voice__copy">
          <strong>Prefer to speak?</strong>
          <small id="voice-help">Live text is a draft. Stop to finish transcription, then review or edit the wording.</small>
          <small className="live-voice__status" role="status">{messages[voice.phase] || voice.notice
            || (!voice.secure ? 'Microphone access needs HTTPS. Use localhost on this computer, or an HTTPS link on your phone. You can still type.'
              : !voice.supported ? 'Live voice is not supported here. You can still type.'
              : !voice.ready ? 'Voice is unavailable. You can still type.' : 'Up to 2 minutes per recording.')}</small>
        </div>
        {voice.active && <span className="voice-time" aria-hidden="true">{Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span>}
        <button type="button" className="voice-toggle" aria-pressed={voice.phase === 'listening'}
          disabled={disabled || (!voice.active && (!voice.supported || !voice.ready))}
          onClick={() => voice.active ? voice.stop() : voice.start()}>{labels[voice.phase]}</button>
      </div>
      {voice.error && <p className="helper error" role="alert">{voice.error}</p>}
      <p className="helper voice-privacy">Audio goes to OpenAI for live transcription. This app does not save recordings. Review names and numbers before organizing; missing business details are not guessed.</p>
    </>
  );
}
