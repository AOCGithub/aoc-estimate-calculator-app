# Live voice input

Status: operational optional feature
Reviewed: 25 November 2026

Voice input writes a transcript into the editable work-description field. It does not fill missing prices or approve inferred business facts. Users must review names, amounts and uncertain wording.

## Behavior

- Start waits for the transcription session, audio transport and microphone settling before showing **Listening**.
- Existing typed text is preserved.
- Stop waits for the final transcript associated with the current recording.
- Silence, device errors, timeouts and released-session callbacks fail safely without replacing newer text.
- Audio is streamed for transcription and is not saved by this application.
- Optional correction proposes small text fixes and preserves quantities, names, negations, approvals and unknowns; uncertain changes require user review.
- Manual edits and Undo take precedence over late provider responses.

## Configuration

Production uses server-only `OPENAI_API_KEY` with `AOC_VOICE_ENABLED=true`. Text correction is controlled separately by `AOC_DESCRIPTION_CORRECTION_ENABLED=true`. HTTPS or localhost and browser microphone permission are required.

Provider failure must leave the description editable and must not block manual continuation.

## Verification

Run `npm run test:live-voice` for synthetic logic and browser coverage. Paid/provider checks are opt-in and must use synthetic audio. A scripted recording does not establish accuracy for every microphone, accent or noisy environment; perform representative human-device checks before making such claims.
