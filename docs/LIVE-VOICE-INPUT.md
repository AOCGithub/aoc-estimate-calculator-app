# Live voice input

Published on 30 October 2026. Live synthetic-speech checks passed at desktop and mobile browser widths, along with a live spelling-correction/Undo check. See [production test results](PRODUCTION-TEST-RESULTS.md).

In **Describe the work**, click **Start live voice input**, allow microphone access, and wait for **Listening** before speaking. Words appear in the existing description field. Stop recording to edit the text, then use the existing organizer or continue with editable fields. Existing typed text is preserved.

After a reported first-word error (“testing” heard as “testem”), startup now waits for the verified transcription session, connected audio transport and open data channel. A 400 ms microphone settling period runs before **Listening** appears. Cancellation also stops this preparation stage. The transcription delay is now `medium`, allowing more audio context before displaying words; live text remains a draft until the final transcript arrives after stopping. These settings were tested with synthetic speech, not every microphone or accent.

OpenAI's `gpt-live-transcribe` model transcribes speech and can revise the captured wording. It does not fill in missing business facts or prices. Users should review names, numbers and unclear wording. This app does not save audio recordings. The transcript enters the editable work description; business details and calculated estimates follow the existing optional database-saving choice.

## Description auto-correction

Local improvements — 3 November 2026 (not yet published): cleanup now distinguishes voice transcripts from typed text, adds missing commas and a final period without rewriting the original words, and offers **Use suggestion** for uncertain wording. A voice-specific single-word check suggested **Testing** for **Testem**, requiring the client to confirm it. Undo remains available. Existing names, numeric formatting, identifiers and approval/negation instructions are protected; unclear amounts are not filled in.

The clean synthetic recording preserved the opening word and commas. A quieter recording with synthetic noise misheard the opening word; increasing transcription delay did not recover it, so the normal `medium` delay was retained. These tests do not establish accuracy for the user's microphone or make inaudible speech reliably recoverable. Local tests also verified comma insertion and confirmation/Undo on desktop and mobile browser widths. No production settings or database records were changed for these checks.

Additional local reliability checks on 3 November: Stop now waits for the final transcript belonging to its committed audio instead of ending on an earlier turn. A closed connection while sending is handled without an uncaught error; existing text remains editable. Missing or busy microphones have specific retry instructions, malformed messages are ignored, and an empty final transcript displays **No words were captured**. Microphone callbacks from a released session cannot stop a newer recording.

The expanded desktop/mobile browser checks cover silence, out-of-order final messages, send failures, final-response timeouts, device removal, background-tab cleanup and the description limit. Two short real-provider checks also passed locally: six seconds of synthetic silence added no words and kept the typed description; clean synthetic speech preserved **Testing**, the spoken sentence and commas through the final transcript. These checks used no physical microphone, saved no database records and did not deploy the changes. Real-device, accent and background-noise checks still need representative recordings; unclear speech cannot be guaranteed correct.

Obvious spelling errors in typed text or the finished transcript are checked after a 1.8-second pause, using the existing organizer's text model and OpenAI key. The check makes small edits, preserves quantities, names, unknowns and action/approval restrictions, and shows uncertain wording as a suggestion for the client to review. It cannot reliably recover words that were inaudible.

Clients can edit the text, turn off auto-correction, or use **Undo correction**. Undo restores the previous text and pauses automatic corrections. Corrections never overwrite newer typing, interrupt an active voice/IME session, or block organizing and continuing when the spelling service is unavailable.

`AOC_DESCRIPTION_CORRECTION_ENABLED=true` enables `/api/journey/correct` separately from voice and is enabled in the production server environment. Text checks use the existing `AOC_INTAKE_MODEL` setting, defaulting to `gpt-5.4`, with `store:false`. Each pause can make a paid text request. There is a process-local limit of 120 checks per hour, not a shared production quota.

Three short real-provider checks passed with synthetic text: typed typos, contextual speech-text typos, and preserved names/unknowns/approval restrictions. They were not tests of inaudible audio. The automated desktop/mobile checks additionally cover cursor position, undo, composition, uncertain suggestions, late replies, errors and navigation/reset cleanup.

## Configuration

- `npm run dev` enables voice in the local preview using the existing server-side OpenAI key.
- Production requires `AOC_VOICE_ENABLED=true`, `AOC_DESCRIPTION_CORRECTION_ENABLED=true` and the existing `OPENAI_API_KEY` in Vercel's server environment, followed by deployment. No new API key is needed.
- `/api/voice/session` checks the existing access session and creates a transcription-only WebRTC connection. Both the company key and short-lived credential stay on the server. Audio streams directly from the browser to OpenAI.
- HTTPS or localhost, browser WebRTC support, microphone permission, and `Permissions-Policy: microphone=(self)` are required. Typing remains available if voice cannot connect.
- For testing on the development computer, open `http://localhost:5173/`. An HTTP LAN address such as `http://192.168.1.8:5173/` cannot access the microphone. Phone testing requires a trusted HTTPS preview; the interface explains this when opened over unsecured HTTP.
- The interface stops each recording after two minutes and respects the existing 18,000-character description limit. The server also limits starts to 12 per process per hour; this is not a shared production quota or a hard provider-side duration limit.

## Checks completed

- Automated desktop and mobile viewport checks: live text, final corrections, typed-text preservation, permission refusal, connection failures, recording limits, and cleanup after navigation or reset.
- Server checks: session/origin validation, configuration, request limits, sanitized failures, private credentials, and Node/Worker parity.
- One real OpenAI connection with synthetic speech: live text arrived before stopping, the final transcript arrived afterward, and existing typed text remained intact. No physical microphone or customer audio was used.
- Two follow-up synthetic checks started speech only after **Listening**: “Testing” was captured correctly on its first occurrence, both by itself and at the start of a sentence. Both live and final text passed with the separate spelling-correction service disabled. Delayed transport readiness and cancellation during microphone preparation also passed desktop/mobile simulations.

Physical microphone and iPhone/Android browser checks remain before production handoff. Automated viewport tests do not establish recognition accuracy for every accent, language or recording environment.

Maintenance references: [OpenAI transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription), [WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?api=realtime), and [model pricing](https://developers.openai.com/api/docs/models/gpt-live-transcribe).
