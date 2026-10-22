import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateEstimate, estimatorBank } from '../lib/domain.js';
import { normalizeAnswers } from '../lib/format.js';
import { numericFields } from '../constants.js';

const createInitialState = (request = 0) => ({
  step: 1,
  area: '',
  description: '',
  answers: {},
  facts: {},
  routes: [],
  routeOverrides: {},
  visible: [],
  manualVisible: [],
  analysis: null,
  confirmed: false,
  result: null,
  dirty: true,
  request,
  working: false,
  calculating: false,
  calculationSource: '',
  analysisError: '',
});

function markDirty(state) {
  return { ...state, dirty: true, confirmed: false, calculating: false };
}

const localAppAliases = [
  ['meta platforms', 'Meta Ads'],
  ['meta ads', 'Meta Ads'],
  ['facebook ads', 'Meta Ads'],
  ['google ads', 'Google Ads'],
  ['google workspace', 'Google Workspace'],
  ['microsoft 365', 'Microsoft 365'],
];

const scopeStopWords = new Set([
  'about', 'after', 'before', 'could', 'does', 'from', 'have', 'help', 'into', 'many',
  'other', 'process', 'should', 'that', 'their', 'there', 'these', 'this', 'through',
  'today', 'using', 'what', 'when', 'where', 'which', 'with', 'would', 'your',
]);

function scopeTokens(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.map((word) => {
    const aliases = {
      ads: 'advertis', advertising: 'advertis', advertised: 'advertis', campaigns: 'campaign',
      customers: 'customer', invoices: 'invoice', payments: 'payment', products: 'product',
      reports: 'report', suppliers: 'supplier', orders: 'order', platforms: 'platform',
    };
    if (aliases[word]) return aliases[word];
    if (word.length > 6 && word.endsWith('ing')) return word.slice(0, -3);
    if (word.length > 5 && word.endsWith('ed')) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
    return word;
  }).filter((word) => word.length >= 3 && !scopeStopWords.has(word)) || []);
}

function tokenOverlap(left, right) {
  let score = 0;
  for (const token of left) if (right.has(token)) score += 1;
  return score;
}

function normalizePrefillValue(id, rawValue) {
  const value = String(rawValue).trim();
  const normalized = value.toLowerCase();
  const includes = (text) => normalized.includes(text);

  if (id === 'responsibility_split') {
    if (includes('shared')) return 'shared';
    if (includes('aoc') || includes('always open')) return 'aoc';
    if (includes('our team') || includes('client')) return 'client';
    if (includes('help') || includes('decide')) return 'help';
  }
  if (id === 'management') {
    if (['yes', 'true'].includes(normalized)) return 'yes';
    if (['no', 'false'].includes(normalized)) return 'no';
  }
  if (id === 'action_mode') {
    if (includes('automatic') || includes('within agreed limits')) return 'automatic';
    if (includes('after approval') || includes('approved')) return 'approved';
    if (includes('draft')) return 'draft';
  }
  if (id === 'consequential') {
    if (/^(yes|true)/.test(normalized)) return 'yes';
    if (/^(no|false)/.test(normalized)) return 'no';
  }
  if (id === 'handover') {
    if (includes('several') || includes('multiple')) return 'multiple';
    if (includes('team') || includes('group')) return 'group';
    if (includes('one') || includes('person')) return 'one';
  }
  if (id === 'cadence') {
    if (includes('real') || includes('event')) return 'realtime';
    if (includes('daily') || includes('every day')) return 'daily';
    if (includes('weekly') || includes('every week')) return 'weekly';
    if (includes('monthly') || includes('every month')) return 'monthly';
  }
  if (id === 'legacy_system_check') {
    if (includes('restrict') || includes('access denied') || includes('unavailable')) return 'Restricted';
    if (includes('custom')) return 'Customized';
    if (includes('older') || includes('legacy')) return 'Older';
    if (includes('standard')) return 'Standard';
    if (includes('not sure') || includes('unknown')) return 'Not sure';
  }
  if (id === 'documentation_readiness') {
    if (includes('clear') || includes('current')) return 'Clear and current';
    if (includes('partial')) return 'Partial documentation';
    if (includes('notes') || includes('examples')) return 'Notes or examples';
    if (includes('staff') || includes('knowledge')) return 'Mostly staff knowledge';
    if (includes('not sure') || includes('unknown')) return 'Not sure';
  }
  if (id === 'data_preparation_level') {
    if (includes('substantial')) return 'Substantial preparation';
    if (includes('some')) return 'Some preparation';
    if (includes('ready')) return 'Mostly ready';
    if (includes('not sure') || includes('unknown')) return 'Not sure';
  }
  if (id === 'delivery_mode') {
    if (includes('managed') || includes('production')) return 'managed';
    if (includes('maintenance') || includes('maintain')) return 'maintenance';
  }
  if (id === 'tier') {
    if (includes('critical')) return 'critical';
    if (includes('priority')) return 'priority';
    if (includes('standard')) return 'standard';
  }
  if (id === 'provider_replaced_portion' || id === 'software_replaced_portion') {
    if (includes('entire') || normalized === 'all') return 'all';
    if (includes('part')) return 'part';
    if (includes('nothing') || includes('none') || normalized === 'no') return 'none';
    if (includes('not sure') || includes('unknown')) return 'unknown';
  }
  if (id === 'response_need') {
    if (includes('urgent')) return 'urgent';
    if (includes('few') || includes('hours')) return 'hours';
    if (includes('next')) return 'next';
    if (includes('recommend')) return 'recommend';
  }

  return value;
}

function createLocalAnalysis(areaId, description) {
  const area = estimatorBank.areas.find((candidate) => candidate.id === areaId);
  const lower = description.toLowerCase();
  const systems = [];
  const evidence = [];

  function findTerm(term) {
    const normalized = term.toLowerCase();
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const index = lower.indexOf(normalized, fromIndex);
      if (index < 0) return -1;
      const before = lower[index - 1] || '';
      const after = lower[index + normalized.length] || '';
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return index;
      fromIndex = index + normalized.length;
    }
    return -1;
  }

  function addSystem(name, matchedText) {
    if (systems.some((system) => system.toLowerCase() === name.toLowerCase())) return;
    systems.push(name);
    evidence.push(matchedText);
  }

  const facts = [];
  const factIds = new Set();
  function addFact(id, value, quote) {
    if (value === null || value === undefined || value === '' || factIds.has(id)) return;
    facts.push({ id, value: String(value), quote });
    factIds.add(id);
  }
  function addMatchedFact(id, pattern, transform = (match) => match[1]) {
    const match = description.match(pattern);
    if (match) addFact(id, transform(match), match[0]);
  }

  for (const name of estimatorBank.appNames) {
    const index = findTerm(name);
    if (index >= 0) addSystem(name, description.slice(index, index + name.length));
  }
  for (const [phrase, name] of localAppAliases) {
    const index = findTerm(phrase);
    if (index >= 0) addSystem(name, description.slice(index, index + phrase.length));
  }
  if (systems.length) addFact('systems', systems.join(', '), description.trim().slice(0, 500));

  addMatchedFact('people_count', /\b(?:team of\s+)?(\d+)\s+(?:people|staff(?: members?)?|employees?|users?)\b/i);
  addMatchedFact('department_count', /\b(\d+)\s+(?:teams?|departments?)\b/i);
  addMatchedFact('team_time', /\b(\d+(?:\.\d+)?)\s+(?:team\s+)?hours?\s+(?:each|per|a)\s+month\b/i);
  addMatchedFact('blended_hourly_cost', /(?:hourly cost(?: of)?|costs?)\s*(?:is|of|about|approximately)?\s*\$?([\d.]+)\s*(?:\/|per )?hour/i);
  addMatchedFact('capability_count', /\b(\d+)\s+(?:connected\s+)?capabilit(?:y|ies)\b/i);
  addMatchedFact('channel_count', /\b(\d+)\s+(?:destination\s+)?channels?\b/i);
  addMatchedFact('format_count', /\b(\d+)\s+(?:output\s+)?formats?\b/i);
  addMatchedFact('brand_count', /\b(\d+)\s+(?:brands?|websites?|sites?)\b/i);
  addMatchedFact('language_count', /\b(\d+)\s+languages?\b/i);
  addMatchedFact('market_count', /\b(\d+)\s+(?:target\s+)?markets?\b/i);
  addMatchedFact('initial_pages', /\b(?:initial(?:ly)?|starting with)\s+(\d+)\s+pages?\b/i);
  addMatchedFact('keyword_count', /\b(\d+)\s+(?:topics?|keywords?)\b/i);

  if (areaId === 'area8') {
    addMatchedFact('monthly_pages', /\b(\d+)\s+pages?\s+(?:each|per|a)\s+month\b/i);
    addMatchedFact('monthly_articles', /\b(\d+)\s+articles?\s+(?:each|per|a)\s+month\b/i);
  } else {
    addMatchedFact('monthly_outputs', /\b(\d+)\s+(?:outputs?|deliverables?|posts?|articles?|campaigns?)\s+(?:each|per|a)\s+month\b/i);
  }

  const cadencePatterns = [
    ['realtime', /\b(?:real[- ]?time|as (?:events|orders|requests) happen)\b/i],
    ['daily', /\b(?:daily|every day)\b/i],
    ['weekly', /\b(?:weekly|every week)\b/i],
    ['monthly', /\b(?:monthly|every month)\b/i],
  ];
  for (const [value, pattern] of cadencePatterns) {
    const match = description.match(pattern);
    if (match) {
      addFact('cadence', value, match[0]);
      break;
    }
  }

  addMatchedFact('documentation_readiness', /\b(?:clear|current|up-to-date)\s+(?:documentation|instructions?|SOPs?)\b/i, () => 'Clear and current');
  addMatchedFact('documentation_readiness', /\bpartial(?:ly)?\s+(?:documented|documentation|instructions?)\b/i, () => 'Partial documentation');
  addMatchedFact('documentation_readiness', /\b(?:notes?|examples?)\b/i, () => 'Notes or examples');
  addMatchedFact('documentation_readiness', /\b(?:staff|team) knowledge\b/i, () => 'Mostly staff knowledge');
  addMatchedFact('data_preparation_level', /\b(?:mostly ready|clean and ready|already organized)\b/i, () => 'Mostly ready');
  addMatchedFact('data_preparation_level', /\b(?:some (?:cleanup|preparation|organizing)|partly organized)\b/i, () => 'Some preparation');
  addMatchedFact('data_preparation_level', /\b(?:substantial|major|extensive) (?:cleanup|preparation|organizing)\b/i, () => 'Substantial preparation');

  addMatchedFact('legacy_system_check', /\b(?:standard|unmodified) (?:app|software|product|system)\b/i, () => 'Standard');
  addMatchedFact('legacy_system_check', /\b(?:customized|customised|custom-built) (?:app|software|product|system)\b/i, () => 'Customized');
  addMatchedFact('legacy_system_check', /\b(?:older|legacy) (?:app|software|product|system)\b/i, () => 'Older');
  addMatchedFact('legacy_system_check', /\b(?:(?:restricted|unavailable) (?:app|software|product|system)|access (?:is )?denied)\b/i, () => 'Restricted');

  addMatchedFact('responsibility_split', /\b(?:shared responsibility|manage it together|jointly managed)\b/i, () => 'shared');
  addMatchedFact('responsibility_split', /\b(?:AOC|Always Open Commerce) (?:manages?|maintains?|handles?)\b/i, () => 'aoc');
  addMatchedFact('responsibility_split', /\b(?:our team|we) (?:manages?|maintains?)\b/i, () => 'client');
  addMatchedFact('action_mode', /\b(?:automatically|without (?:manual|human) approval)\b/i, () => 'automatic');
  addMatchedFact('action_mode', /\b(?:after approval|once approved|following approval)\b/i, () => 'approved');
  addMatchedFact('action_mode', /\b(?:prepares?|creates?|writes?) drafts? (?:for|before) (?:a person|staff|our team|human)?\s*(?:to )?approv/i, () => 'draft');
  addMatchedFact('consequential', /\b(?:affect|change|update) (?:money|payments?|stock|inventory|orders?|sensitive records?)\b/i, () => 'yes');

  addMatchedFact('handover', /\b(?:train|handover to) (?:one|1) person\b/i, () => 'one');
  addMatchedFact('handover', /\b(?:train|handover to) (?:one|1) team\b/i, () => 'group');
  addMatchedFact('handover', /\b(?:train|handover to) (?:several|multiple|\d+) teams?\b/i, () => 'multiple');
  addMatchedFact('delivery_mode', /\bAOC (?:handles?|manages?) (?:the )?(?:production|delivery|content)\b/i, () => 'managed');
  addMatchedFact('delivery_mode', /\b(?:our team|we) (?:handles?|manages?) (?:the )?(?:production|delivery|content)\b/i, () => 'maintenance');

  const descriptionTokens = scopeTokens(description);
  const routeCandidates = [...new Set((area?.fields || []).map((field) => field.route).filter(Boolean))];
  const routes = routeCandidates.map((route) => ({
    route,
    score: tokenOverlap(descriptionTokens, scopeTokens(route)),
  })).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ route }) => route);

  const materialQuestion = /number|how many|volume|scope|which .*included|what should.*handle|what.*included|rule|approval|exception|restriction|access|review/i;
  const fieldScores = (area?.fields || []).filter((field) => field.id !== 'generic').map((field) => ({
    field,
    score: tokenOverlap(
      descriptionTokens,
      scopeTokens(`${field.question} ${field.options || ''} ${field.purpose || ''}`),
    ),
  })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  const relevantFields = fieldScores.filter(({ score }) => score >= 2).slice(0, 6).map(({ field }) => field.id);
  for (const route of routes) {
    const routeFields = (area?.fields || []).filter((field) => field.route === route);
    const important = routeFields.find((field) => materialQuestion.test(field.question));
    if (important && !relevantFields.includes(important.id) && relevantFields.length < 8) {
      relevantFields.push(important.id);
    }
  }
  if (!relevantFields.length) {
    relevantFields.push(...fieldScores.slice(0, 3).map(({ field }) => field.id));
  }

  for (const match of description.matchAll(/\b(\d+(?:\.\d+)?)\s+([a-z][a-z-]*)\b/gi)) {
    const nounTokens = scopeTokens(match[2]);
    const candidate = fieldScores.find(({ field }) =>
      materialQuestion.test(field.question)
      && tokenOverlap(nounTokens, scopeTokens(`${field.question} ${field.purpose || ''}`)) > 0
      && !factIds.has(field.id));
    if (candidate) {
      addFact(candidate.field.id, match[1], match[0]);
      if (!relevantFields.includes(candidate.field.id)) relevantFields.unshift(candidate.field.id);
    }
  }
  const agentSignals = /\b(ai|agent|interpret|classif\w*|decid\w*|recommend\w*|prioriti[sz]\w*)\b/i;
  const solution = agentSignals.test(description) ? 'agent' : 'workflow';
  return {
    title: `${area?.title || 'Business'} process`,
    summary: description.trim().replace(/\s+/g, ' ').slice(0, 320),
    solution,
    recommendationReason: solution === 'agent'
      ? 'Your wording suggests judgment or recommendations may be involved; confirm this classification.'
      : 'A workflow is the conservative starting point until the required complexity questions are reviewed.',
    classification: {
      steps: null,
      variations: null,
      decisions: null,
      reason: 'Local organization does not infer pricing-sensitive complexity.',
    },
    routes,
    facts,
    relevantFields: [...new Set(relevantFields)].slice(0, 8),
    uncertainties: [
      'Basic local organization was used. Review every required field before calculating.',
    ],
    localFallback: true,
  };
}

async function readAnalysisResponse(response) {
  const body = await response.text();
  let data = null;
  let invalidJson = false;

  if (body.trim()) {
    try {
      data = JSON.parse(body);
    } catch {
      invalidJson = true;
    }
  }

  if (!response.ok || invalidJson || (!data?.analysis && !data?.localFallback)) {
    return { localFallback: true };
  }

  return data;
}

export function useEstimator() {
  const [state, setState] = useState(createInitialState);
  const requestRef = useRef(0);

  const selectedArea = useMemo(
    () => estimatorBank.areas.find((area) => area.id === state.area),
    [state.area],
  );

  const goTo = useCallback((step) => {
    setState((current) => {
      if (!current.area && step > 1) return current;
      return { ...current, step };
    });
    requestAnimationFrame(() => {
      document.getElementById('mainPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const chooseArea = useCallback((area) => {
    setState((current) => {
      if (current.area === area) return current;
      requestRef.current += 1;
      return { ...createInitialState(requestRef.current), area };
    });
  }, []);

  const setDescription = useCallback((description) => {
    requestRef.current += 1;
    setState((current) => markDirty({
      ...current,
      description,
      request: requestRef.current,
      analysisError: '',
    }));
  }, []);

  const mark = useCallback((key, rawValue) => {
    let value = rawValue;
    if (numericFields.has(key)) {
      value = rawValue === '' || rawValue === null ? null : Number(rawValue);
      if (value !== null && (!Number.isFinite(value) || value < 0)) return false;
    } else {
      value = rawValue === '' ? null : rawValue;
    }

    requestRef.current += 1;
    setState((current) => {
      const answers = { ...current.answers, [key]: value };
      if (key === 'responsibility_split') {
        answers.management = ['aoc', 'shared'].includes(value)
          ? 'yes'
          : value === 'client'
            ? 'no'
            : null;
        if (answers.management !== 'yes') answers.tier = null;
      }
      const facts = { ...current.facts };
      delete facts[key];
      if (key === 'responsibility_split') delete facts.management;
      return markDirty({ ...current, answers, facts });
    });
    return true;
  }, []);

  const toggleRoute = useCallback((route) => {
    requestRef.current += 1;
    setState((current) => {
      const currentArea = estimatorBank.areas.find((area) => area.id === current.area);
      if (!currentArea) return current;
      const isSelected = current.routes.includes(route);
      if (isSelected) {
        const routeFieldIds = currentArea.fields
          .filter((field) => field.route === route)
          .map((field) => field.id);
        return markDirty({
          ...current,
          routes: current.routes.filter((item) => item !== route),
          routeOverrides: { ...current.routeOverrides, [route]: false },
          visible: current.visible.filter(
            (id) => !routeFieldIds.includes(id) || current.answers[id] || current.manualVisible.includes(id),
          ),
        });
      }

      const routeFields = currentArea.fields.filter((field) => field.route === route);
      const materialFields = routeFields.filter((field) =>
        /number|how many|volume|scope|which .*included|what should.*handle|what.*included|billing rule|amount.*work|different.*rule/i.test(
          field.question,
        ),
      );
      const suggestions = materialFields.length ? materialFields : routeFields.slice(0, 2);
      return markDirty({
        ...current,
        routes: [...current.routes, route],
        routeOverrides: { ...current.routeOverrides, [route]: true },
        visible: [...new Set([...current.visible, ...suggestions.map((field) => field.id)])],
      });
    });
  }, []);

  const addVisibleField = useCallback((fieldId) => {
    requestRef.current += 1;
    setState((current) => markDirty({
      ...current,
      visible: [...new Set([...current.visible, fieldId])],
      manualVisible: [...new Set([...current.manualVisible, fieldId])],
    }));
  }, []);

  const setConfirmed = useCallback((confirmed) => {
    requestRef.current += 1;
    setState((current) => ({ ...current, confirmed, calculating: false }));
  }, []);

  const calculate = useCallback(async () => {
    if (!state.confirmed) return { ok: false, message: 'Please confirm the reviewed scope first.' };
    const request = ++requestRef.current;
    const areaId = state.area;
    const answers = normalizeAnswers(state.answers);
    setState((current) => ({ ...current, calculating: true }));
    let result;
    let source = 'server';
    let response;
    try {
      response = await fetch('/api/journey/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: areaId, answers, confirmed: true }),
      });
    } catch {
      source = 'local-preview';
      result = calculateEstimate({ ...answers, area: areaId, process_confirmed: true });
    }

    if (response) {
      let payload = null;
      try {
        const text = await response.text();
        payload = text.trim() ? JSON.parse(text) : null;
      } catch {
        // An unreadable response means the calculation service is unavailable.
      }

      if (response.ok && payload?.result) {
        result = payload.result;
      } else if (response.status >= 400 && response.status < 500) {
        if (request !== requestRef.current) return { ok: false, stale: true };
        setState((current) => ({ ...current, calculating: false }));
        return {
          ok: false,
          message: payload?.error || 'Please review the calculation details and try again.',
        };
      } else {
        source = 'local-preview';
        result = calculateEstimate({ ...answers, area: areaId, process_confirmed: true });
      }
    }
    if (request !== requestRef.current) return { ok: false, stale: true };
    setState((current) => ({
      ...current,
      result,
      dirty: false,
      calculating: false,
      calculationSource: source,
    }));
    return {
      ok: true,
      message: source === 'server'
        ? 'Estimate calculated and verified by the server.'
        : 'Server calculation is unavailable; showing a local preview that requires server verification.',
    };
  }, [state.answers, state.area, state.confirmed]);

  const organize = useCallback(async () => {
    if (state.description.trim().length < 30) {
      return { ok: false, message: 'Add a little more detail, or continue with editable fields.' };
    }

    const request = ++requestRef.current;
    const description = state.description;
    const areaId = state.area;
    setState((current) => ({ ...current, working: true, analysisError: '', request }));

    try {
      let data;
      try {
        const response = await fetch('/api/journey/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: areaId, text: description }),
        });
        data = await readAnalysisResponse(response);
      } catch {
        data = { localFallback: true };
      }
      if (request !== requestRef.current) return { ok: false, stale: true };

      const analysis = data.localFallback
        ? createLocalAnalysis(areaId, description)
        : data.analysis;
      setState((current) => {
        if (current.area !== areaId) return current;
        const answers = { ...current.answers };
        for (const key of Object.keys(current.facts)) delete answers[key];
        const facts = {};

        for (const fact of analysis.facts) {
          if (answers[fact.id] !== undefined && !current.facts[fact.id]) continue;
          let value = normalizePrefillValue(fact.id, fact.value);
          if (numericFields.has(fact.id)) {
            if (!/^\d+(\.\d+)?$/.test(String(value))) continue;
            value = Number(value);
          }
          if (fact.id === 'systems') {
            value = value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
          }
          answers[fact.id] = value;
          facts[fact.id] = fact.quote;
        }

        if (Object.prototype.hasOwnProperty.call(answers, 'responsibility_split')) {
          const responsibility = answers.responsibility_split;
          answers.management = ['aoc', 'shared'].includes(responsibility)
            ? 'yes'
            : responsibility === 'client'
              ? 'no'
              : null;
          if (facts.responsibility_split) facts.management = facts.responsibility_split;
          else delete facts.management;
          if (answers.management !== 'yes') answers.tier = null;
        }

        for (const [key, value] of [
          ['steps_band', analysis.classification.steps],
          ['variation_band', analysis.classification.variations],
          ['decision_band', analysis.classification.decisions],
        ]) {
          if (value !== null && (answers[key] === undefined || current.facts[key])) {
            answers[key] = value;
            facts[key] = 'Proposed classification; review the explanation.';
          }
        }

        if (!answers.solution || current.facts.solution) {
          answers.solution = analysis.solution;
          facts.solution = 'Recommended from your description; editable.';
        }

        const routes = [
          ...analysis.routes.filter((route) => current.routeOverrides[route] !== false),
          ...Object.entries(current.routeOverrides)
            .filter(([, selected]) => selected)
            .map(([route]) => route),
        ];
        const currentArea = estimatorBank.areas.find((area) => area.id === current.area);
        const manualRouteFields = current.visible.filter((id) => {
          const field = currentArea?.fields.find((candidate) => candidate.id === id);
          return field && current.routeOverrides[field.route] === true;
        });

        return markDirty({
          ...current,
          step: 3,
          answers,
          facts,
          analysis,
          routes: [...new Set(routes)],
          visible: [...new Set([
            ...analysis.relevantFields,
            ...current.manualVisible,
            ...manualRouteFields,
          ])],
          working: false,
          analysisError: '',
        });
      });
      return {
        ok: true,
        message: analysis.localFallback
          ? 'Description organized locally. Review the required details before calculating.'
          : 'Description organized. Review and complete the remaining details.',
      };
    } catch (error) {
      if (request === requestRef.current) {
        setState((current) => ({
          ...current,
          working: false,
          analysisError: error.message,
        }));
      }
      return { ok: false, message: error.message };
    }
  }, [state.area, state.description]);

  const restart = useCallback(() => {
    requestRef.current += 1;
    setState(createInitialState(requestRef.current));
  }, []);

  useEffect(() => {
    globalThis.AOCJourney = {
      getState: () => structuredClone(state),
      calculate: calculateEstimate,
    };
  }, [state]);

  return {
    state,
    selectedArea,
    actions: {
      addVisibleField,
      calculate,
      chooseArea,
      goTo,
      mark,
      organize,
      restart,
      setConfirmed,
      setDescription,
      toggleRoute,
    },
  };
}
