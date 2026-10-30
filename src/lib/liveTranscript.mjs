// Reconcile partial/final turns by ID; final text replaces its partial, never duplicates it.
export function createLiveTranscript(prefix = '', limit = 18000) {
  const turns = new Map();
  const seen = new Set();
  return {
    update(event) {
      if (event.event_id && seen.has(event.event_id)) return;
      if (event.event_id) seen.add(event.event_id);
      if (!event.item_id) return;
      const turn = turns.get(event.item_id) || { text: '', done: false };
      if (event.type === 'input_audio_buffer.committed') turn.previous = event.previous_item_id;
      if (event.type === 'conversation.item.input_audio_transcription.delta' && !turn.done && typeof event.delta === 'string') turn.text += event.delta;
      if (event.type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
        turn.text = event.transcript;
        turn.done = true;
      }
      turns.set(event.item_id, turn);
    },
    completed(id) { return turns.get(id)?.done === true; },
    text() {
      const ordered = [];
      const visited = new Set();
      function add(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const turn = turns.get(id);
        if (turn.previous && turns.has(turn.previous)) add(turn.previous);
        if (turn.text.trim()) ordered.push(turn.text.trim());
      }
      for (const id of turns.keys()) add(id);
      const spoken = ordered.join(' ');
      const separator = prefix && !/\s$/u.test(prefix) ? '\n\n' : '';
      return (spoken ? prefix + separator + spoken : prefix).slice(0, limit);
    },
  };
}
