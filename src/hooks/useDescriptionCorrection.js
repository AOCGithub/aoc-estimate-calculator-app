import { useEffect, useRef, useState } from 'react';

export function useDescriptionCorrection({ description, area, source = 'typed', blocked, onChange, textareaRef }) {
  const latest = useRef({ description, area, source, blocked, onChange });
  latest.current = { description, area, source, blocked, onChange };
  const cacheKey = text => area + '\n' + source + '\n' + text;
  const checked = useRef('');
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [feedback, setFeedback] = useState({ text: description, checking: false, message: '', undo: null, review: [] });

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch('/api/journey/correct', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (mounted.current && !controller.signal.aborted) setReady(response.ok && data.configured === true);
      }).catch(() => { /* Browser spellcheck and typing remain available. */ });
    return () => { mounted.current = false; controller.abort(); };
  }, []);

  useEffect(() => {
    setFeedback(value => value.text === description ? { ...value, checking: false }
      : { text: description, checking: false, undo: null, review: [], message: '' });
    if (!ready || !enabled || blocked || description.trim().length < 4 || checked.current === cacheKey(description)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFeedback(value => ({ ...value, checking: true, message: '' }));
      try {
        const response = await fetch('/api/journey/correct', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area, text: description, source }), signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted || !mounted.current || latest.current.description !== description
          || latest.current.area !== area || latest.current.source !== source || latest.current.blocked) return;
        if (!response.ok || typeof data.text !== 'string' || data.text.length > 18000
          || !Array.isArray(data.edits) || !Array.isArray(data.review)) throw new Error('Correction unavailable.');
        checked.current = cacheKey(data.text);
        const changed = data.text !== description;
        setFeedback({ text: data.text, checking: false, message: changed ? 'Spelling or punctuation corrected. Review your wording.' : data.review.length ? 'Some wording needs your review.' : '',
          undo: changed ? { before: description, after: data.text } : null, review: data.review });
        if (changed) {
          const element = textareaRef.current;
          const focused = document.activeElement === element;
          const start = element?.selectionStart, end = element?.selectionEnd;
          const mapPosition = position => position + data.edits.reduce((delta, edit) => {
            if (position < edit.start || (position === edit.start && edit.before.length > 0)) return delta;
            if (position >= edit.start + edit.before.length) return delta + edit.after.length - edit.before.length;
            return delta + edit.after.length - (position - edit.start);
          }, 0);
          latest.current.onChange(data.text);
          if (focused) requestAnimationFrame(() => {
            if (mounted.current && document.activeElement === element && element.value === data.text) {
              element.setSelectionRange(mapPosition(start), mapPosition(end));
            }
          });
        }
      } catch {
        if (!controller.signal.aborted && mounted.current) {
          checked.current = cacheKey(description);
          setFeedback({ text: description, checking: false, message: 'Spelling check is unavailable. Your text is unchanged; you can continue.', undo: null, review: [] });
        }
      }
    }, 1800);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [description, area, source, blocked, enabled, ready, textareaRef]);

  function undo() {
    if (!feedback.undo || latest.current.description !== feedback.undo.after || latest.current.blocked) return;
    checked.current = cacheKey(feedback.undo.before);
    setEnabled(false);
    latest.current.onChange(feedback.undo.before);
    setFeedback({ text: feedback.undo.before, checking: false, message: 'Original wording restored. Auto-correct is paused.', undo: null, review: [] });
  }

  function applySuggestion(item) {
    const before = latest.current.description;
    const start = before.indexOf(item.before);
    if (latest.current.blocked || feedback.text !== before || start < 0 || before.indexOf(item.before, start + 1) !== -1) return;
    const after = before.slice(0, start) + item.after + before.slice(start + item.before.length);
    if (after.length > 18000) return;
    checked.current = cacheKey(after);
    latest.current.onChange(after);
    setFeedback({ text: after, checking: false, message: 'Suggested wording applied. Please review it.',
      undo: { before, after }, review: feedback.review.filter(value => value !== item) });
  }

  return { ...feedback, ready, enabled, undo, applySuggestion, canUndo: Boolean(feedback.undo && feedback.undo.after === description),
    toggle(value) { checked.current = ''; setEnabled(value); },
  };
}
