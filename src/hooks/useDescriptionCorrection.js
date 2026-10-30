import { useEffect, useRef, useState } from 'react';

export function useDescriptionCorrection({ description, area, blocked, onChange, textareaRef }) {
  const latest = useRef({ description, area, blocked, onChange });
  latest.current = { description, area, blocked, onChange };
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
    if (!ready || !enabled || blocked || description.trim().length < 4 || checked.current === description) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFeedback(value => ({ ...value, checking: true, message: '' }));
      try {
        const response = await fetch('/api/journey/correct', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area, text: description }), signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted || !mounted.current || latest.current.description !== description
          || latest.current.area !== area || latest.current.blocked) return;
        if (!response.ok || typeof data.text !== 'string' || data.text.length > 18000
          || !Array.isArray(data.edits) || !Array.isArray(data.review)) throw new Error('Correction unavailable.');
        checked.current = data.text;
        const changed = data.text !== description;
        setFeedback({ text: data.text, checking: false, message: changed ? 'Spelling corrected. Review your wording.' : '',
          undo: changed ? { before: description, after: data.text } : null, review: data.review });
        if (changed) {
          const element = textareaRef.current;
          const focused = document.activeElement === element;
          const start = element?.selectionStart, end = element?.selectionEnd;
          const mapPosition = position => position + data.edits.reduce((delta, edit) => {
            if (position <= edit.start) return delta;
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
          checked.current = description;
          setFeedback({ text: description, checking: false, message: 'Spelling check is unavailable. Your text is unchanged; you can continue.', undo: null, review: [] });
        }
      }
    }, 1800);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [description, area, blocked, enabled, ready, textareaRef]);

  function undo() {
    if (!feedback.undo || latest.current.description !== feedback.undo.after || latest.current.blocked) return;
    checked.current = feedback.undo.before;
    setEnabled(false);
    latest.current.onChange(feedback.undo.before);
    setFeedback({ text: feedback.undo.before, checking: false, message: 'Original wording restored. Auto-correct is paused.', undo: null, review: [] });
  }

  return { ...feedback, ready, enabled, undo, canUndo: Boolean(feedback.undo && feedback.undo.after === description),
    toggle(value) { checked.current = ''; setEnabled(value); },
  };
}
