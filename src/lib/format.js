export function money(value) {
  if (value === null || value === undefined) return 'Not yet calculated';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function hours(value) {
  return value === null ? 'Unknown' : `${Number(value.toFixed(1))} hours / month`;
}

export function normalizeAnswers(answers) {
  const systems = answers.systems;
  return {
    ...answers,
    systems:
      typeof systems === 'string'
        ? systems.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean)
        : systems,
  };
}
