export function money(value) {
  if (value === null || value === undefined) return 'Needs details';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function hours(value) {
  return value === null ? 'Unknown' : `${Number(value.toFixed(1))} hours / month`;
}

export function normalizeAnswers(answers) {
  const systems = answers.systems;
  const normalizedSystems = typeof systems === 'string' ? systems.trim() : systems;
  const connectionAnswer = typeof normalizedSystems === 'string'
    && /^(?:none|no apps?|no connections?|not applicable|not sure|unknown)$/i.test(normalizedSystems);
  return {
    ...answers,
    systems: typeof systems !== 'string' ? systems
      : !normalizedSystems ? null
        : connectionAnswer ? normalizedSystems
          : normalizedSystems.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
  };
}
