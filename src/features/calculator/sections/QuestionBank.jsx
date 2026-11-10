import { useMemo } from 'react';

export function QuestionBank({ candidates, visible, onAdd, query, onQueryChange }) {
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return candidates.filter((field) =>
      !visible.includes(field.id)
      && (!normalized || `${field.question} ${field.route} ${field.options}`.toLowerCase().includes(normalized)),
    );
  }, [candidates, query, visible]);

  return (
    <details className="field-bank" id="scope-question-bank">
      <summary>Find another relevant scope question ({candidates.length} in this bank)</summary>
      <p>
        This is a reference bank, not a required questionnaire. Add a detail only if it changes
        scope, price or feasibility. Detailed implementation questions belong in the audit.
      </p>
      <input
        value={query}
        placeholder="Search questions, e.g. invoices, design, keywords"
        aria-label="Search scope question bank"
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div>
        {results.slice(0, 15).map((field) => (
          <div className="bank-item" key={field.id} data-field-id={field.id}>
            <span>{field.question}<small>{field.route}</small></span>
            <button type="button" onClick={() => onAdd(field.id)}>Add</button>
          </div>
        ))}
        {results.length > 15 && <p className="helper">Search to narrow the remaining questions.</p>}
      </div>
    </details>
  );
}
