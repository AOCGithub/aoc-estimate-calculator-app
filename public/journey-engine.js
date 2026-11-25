(function(root) {
  const Bank = typeof module === 'object' ? require('./approved-bank.js') : root.AOCBank;
  const Price = typeof module === 'object' ? require('./approved-pricing.js') : root.AOCPricing;
  const Rules = Price.simplified;

  const number = value => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const rangeMoney = value => Math.round(value / Rules.rangeRounding) * Rules.rangeRounding;
  const normalized = value => String(value ?? '').trim().toLowerCase();

  function getConnections(value) {
    if (Array.isArray(value)) {
      const apps = value.map(app => String(app).trim()).filter(Boolean);
      return [...new Map(apps.map(app => [normalized(app), app])).values()];
    }
    if (typeof value !== 'string' || !value.trim()) return null;
    if (/^(none|no apps?|no connections?|not applicable)$/i.test(value.trim())) return [];
    if (/^(not sure|unknown)$/i.test(value.trim())) return null;
    const apps = value.split(/[,;\n]+/).map(app => app.trim()).filter(Boolean);
    return [...new Map(apps.map(app => [normalized(app), app])).values()];
  }

  function complexityBand(input, assumptions) {
    const values = [number(input.steps_band), number(input.variation_band)];
    if (input.solution === 'agent') values.push(number(input.decision_band));
    const present = values.filter(value => value !== null);
    if (present.some(value => !Number.isInteger(value) || value < 1 || value > 4)) return null;
    if (present.length !== values.length) {
      assumptions.push('Missing complexity answers were treated as Moderate; higher known answers were retained.');
      return Math.max(2, ...present);
    }
    return Math.max(...present);
  }

  function preparationLevel(input, warnings, assumptions) {
    const level = input.data_preparation_level;
    if (level === 'clean' && input.documentation_readiness === 'Clear and current') return 'clean';
    if (level === 'clean') {
      warnings.push('The readiness answers do not both confirm complete, current, usable instructions and data; the $0 preparation amount was not used.');
      return 'existing';
    }
    if (['existing', 'partial', 'limited'].includes(level)) return level;
    assumptions.push('Preparation readiness was unknown; the explicit $2,000 preparation allowance was used.');
    return 'unknown';
  }

  function monthlyWorkload(input, complexity, connectionCount, assumptions) {
    const area = Bank.areas.find(candidate => candidate.id === input.area);
    const candidates = (area?.fields || [])
      .filter(field => /month|monthly/i.test(field.question))
      .map(field => number(input[field.id]))
      .filter(value => value !== null);
    const explicitVolume = candidates.length > 0;
    const monthlyItems = explicitVolume
      ? Math.max(...candidates)
      : Rules.usage.defaultMonthlyItems;
    const scheduledChecks = input.cadence === 'hourly'
      ? Rules.usage.hourlyChecks
      : Rules.usage.defaultMonthlyChecks;
    if (!explicitVolume) assumptions.push(`Monthly workload was unknown; ${Rules.usage.defaultMonthlyItems} items were assumed.`);
    assumptions.push(`${scheduledChecks} scheduled checks per month were assumed for the Make budget.`);

    const usageLevel = complexity === 1 ? 'simple' : complexity === 2 ? 'moderate' : 'complex';
    const usage = Rules.usage[usageLevel];
    const selectedTaskCount = number(input.selected_task_count);
    const extraTasks = Math.max(0, (selectedTaskCount === null ? 1 : selectedTaskCount) - 1);
    const taskFactor = 1 + Rules.usage.extraTaskFactor * extraTasks;
    const informationText = Object.entries(input)
      .filter(([key]) => key.startsWith('data_material_'))
      .map(([, value]) => String(value ?? ''))
      .join(' ');
    const documentHeavy = /\b(pdf|scans?|handwriting|attachments?|extraction)\b/i.test(informationText)
      || /\b(some|substantial)\b/i.test(String(input.data_material_format || ''));
    const informationFactor = documentHeavy ? Rules.usage.documentHeavyFactor : 1;
    const credits = (base, perConnection) => Math.ceil(
      Math.max(Rules.usage.minimumCredits, (monthlyItems * (base + perConnection * connectionCount)
        * taskFactor * informationFactor + scheduledChecks) * Rules.usage.buffer) / Rules.usage.rounding,
    ) * Rules.usage.rounding;
    const lowCredits = credits(usage.low, Rules.usage.connectionLow);
    const highCredits = credits(usage.high, Rules.usage.connectionHigh);
    const budgetRounding = Rules.makeBudget.rounding;
    const lowBudget = Math.max(
      Rules.makeBudget.minimumLow,
      Math.ceil((lowCredits * Rules.makeBudget.per1000CreditsLow / 1000)
        / budgetRounding) * budgetRounding,
    );
    const highBudget = Math.max(
      Rules.makeBudget.minimumHigh,
      Math.ceil((highCredits * Rules.makeBudget.per1000CreditsHigh / 1000)
        / budgetRounding) * budgetRounding,
      lowBudget,
    );
    return {
      complexity: usageLevel,
      monthlyItems,
      scheduledChecks,
      selectedTaskCount: extraTasks + 1,
      lowCredits,
      highCredits,
      lowBudget,
      highBudget,
      documentHeavy,
      explicitVolume,
    };
  }

  function savings(input, prefix, errors) {
    const amountKey = prefix === 'provider'
      ? 'replacement_provider_cost' : 'software_replaced_cost';
    const portionKey = prefix === 'provider'
      ? 'provider_replaced_portion' : 'software_replaced_portion';
    const removedKey = prefix === 'provider'
      ? 'provider_removed_amount' : 'software_removed_amount';
    const amount = number(input[amountKey]);
    const portion = input[portionKey];
    const removedAmount = number(input[removedKey]);
    if (amount !== null && amount < 0) errors.push(`${prefix} cost cannot be negative.`);
    if (removedAmount !== null && removedAmount < 0) errors.push(`${prefix} savings cannot be negative.`);
    if (amount === null || portion === 'none') return { amount: 0, counted: false };
    if (portion === 'all') return { amount, counted: amount > 0 };
    if (portion === 'part' && removedAmount !== null) {
      if (removedAmount > amount) errors.push(`${prefix} savings cannot exceed current cost.`);
      return { amount: Math.min(amount, removedAmount), counted: removedAmount > 0 };
    }
    return { amount: 0, counted: false };
  }

  function calculate(input, pricing = Price) {
    const rules = pricing.simplified || Rules;
    const errors = [];
    const pending = [];
    const warnings = [];
    const assumptions = [];
    const lines = [];
    const add = (label, amount, status) => {
      if (amount > 0) lines.push({ label, amount, ...(status ? { status } : {}) });
    };

    if (!rules.activeAreaIds.includes(input.area)) {
      errors.push('Choose one of the currently available business areas.');
    }
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
        errors.push(`Use a nonnegative finite value for ${key}.`);
      }
    }
    if (!input.process_confirmed) pending.push('Review and confirm the process scope.');

    const band = complexityBand(input, assumptions);
    if (band === null) errors.push('Complexity answers must be whole numbers from 1 to 4.');
    const level = band === null ? 'moderate' : band === 1 ? 'simple' : band === 2 ? 'moderate' : 'complex';
    const connections = getConnections(input.systems);
    if (connections === null) pending.push('List the apps that must connect, or explicitly choose that no app connection is needed.');
    const connectionCount = connections?.length ?? 0;

    const people = number(input.people_count);
    const departments = number(input.department_count);
    if (people === null || people < 1 || !Number.isInteger(people)) {
      pending.push('Enter a positive whole number of people in scope.');
    }
    if (departments === null || departments < 1 || !Number.isInteger(departments)) {
      pending.push('Enter a positive whole number of departments in scope.');
    }

    for (const [key, label] of [
      ['workspace_context', 'Choose the business workspace context or Not sure.'],
      ['ai_account_context', 'Choose the AI account context or Not sure.'],
      ['documentation_readiness', 'Confirm what instructions or examples are available.'],
      ['data_information_location', 'Confirm where the process information is located or choose Not sure.'],
      ['data_preparation_level', 'Confirm the preparation/readiness level or choose Not sure.'],
      ['data_preparation_owner', 'Confirm who will prepare missing information or choose Not sure.'],
    ]) {
      if (!input[key]) pending.push(label);
    }

    const prep = preparationLevel(input, warnings, assumptions);
    const prepCost = rules.prep[prep];
    const componentsComplete = band !== null && connections !== null
      && people !== null && people >= 1 && Number.isInteger(people)
      && departments !== null && departments >= 1 && Number.isInteger(departments);
    if (componentsComplete) {
      add(`${level[0].toUpperCase()}${level.slice(1)} workflow core`, rules.core[level]);
      add(prep === 'clean' ? 'Documentation and data preparation' : 'Documentation and data preparation allowance', prepCost);
      add('Required app/product connections', connectionCount * rules.extraApp);
      const rollout = people <= 4 ? rules.rolloutBase
        : people <= 15 ? rules.rolloutBase + rules.rolloutMedium
          : rules.rolloutBase + rules.rolloutLarge;
      add('Workflow-user rollout', rollout);
      add('Department ownership and handoffs', departments * rules.departmentBase);

      if (input.action_mode === 'automatic') {
        if (input.consequential === 'yes') {
          add('Consequential automatic-action controls', rules.control);
        } else if (input.consequential !== 'no') {
          add('Human review workflow (assumed)', rules.reviewWorkflow);
          pending.push('Confirm whether automatic actions affect money, stock, orders, or sensitive records.');
        }
      } else if (input.action_mode === 'draft' || input.action_mode === 'approved') {
        add('Human review workflow', rules.reviewWorkflow);
      } else {
        add('Human review workflow (assumed)', rules.reviewWorkflow);
        assumptions.push('Action behavior was unknown; review-first handling was assumed.');
      }

      add(
        'Launch Support (proposed; one-time)',
        rules.launchSupport.amount,
        'Proposed — not finalized',
      );
      warnings.push(rules.notices.launchSupport);
    }

    if (input.data_material_conflict
      && !/^(no known conflict|no conflict|none|not sure|unknown)$/i.test(String(input.data_material_conflict).trim())) {
      pending.push('AOC must review the known information conflict before confirming feasibility.');
    }
    if (input.data_material_restriction
      && !/^(available|not sure|unknown)$/i.test(String(input.data_material_restriction).trim())) {
      pending.push('AOC must review the information restriction before confirming feasibility.');
    }

    const hoursValue = number(input.team_time);
    const rate = number(input.blended_hourly_cost);
    if (hoursValue === null) pending.push('Monthly team hours are required for the baseline ROI.');
    else if (hoursValue <= 0) errors.push('Monthly team hours must be greater than zero.');
    if (rate === null) pending.push('Average internal hourly cost is required for the baseline ROI.');
    else if (rate <= 0) errors.push('Average internal hourly cost must be greater than zero.');

    const freed = hoursValue !== null && hoursValue > 0 ? hoursValue * rules.freedFraction : null;
    const retained = hoursValue !== null && hoursValue > 0 ? hoursValue * rules.retainedFraction : null;
    const capacity = freed !== null && rate !== null && rate > 0 ? roundMoney(freed * rate) : null;
    const provider = savings(input, 'provider', errors);
    const software = savings(input, 'software', errors);
    const confirmedCash = roundMoney(provider.amount + software.amount);
    const cash = provider.counted || software.counted ? confirmedCash : null;
    const baselineMonthlyBenefit = capacity === null ? null : roundMoney(capacity + confirmedCash);
    const providerNotCounted = !provider.counted;
    const softwareNotCounted = !software.counted;

    const subtotal = lines.reduce((total, line) => total + line.amount, 0);
    const build = componentsComplete && !errors.some(error => /people in scope|departments in scope|Complexity answers/.test(error))
      ? roundMoney(subtotal) : null;
    const low = build === null ? null : rangeMoney(build * rules.rangeLow);
    const high = build === null ? null : rangeMoney(build * rules.rangeHigh);
    const audit = build === null ? null : roundMoney(build * rules.auditFraction);
    const workload = band === null ? null : monthlyWorkload(input, band, connectionCount, assumptions);
    const roiReady = freed !== null && capacity !== null;
    const buildBlockers = pending.some(item =>
      /apps that must connect|people in scope|departments in scope|automatic actions affect|information conflict|information restriction|confirm the process scope/i.test(item),
    );
    const pendingUnique = [...new Set(pending)];
    const eligible = build !== null && !errors.length && !buildBlockers && roiReady
      && pendingUnique.length === 0;
    const creditReason = `The ${rules.paidServiceName} fee may be credited once toward an accepted fixed-price implementation when eligible. AOC confirms eligibility and timing.`;

    return {
      version: rules.version,
      lines,
      known: roundMoney(subtotal),
      build,
      provisionalBuild: build,
      buildQuoted: false,
      low,
      high,
      audit,
      auditRate: rules.auditFraction,
      auditPurchasable: eligible,
      paidServiceName: rules.paidServiceName,
      freeServiceName: rules.freeServiceName,
      credit: { status: 'conditional', amount: null, potentialAmount: audit, reason: creditReason },
      level,
      pending: pendingUnique,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      assumptions: [...new Set(assumptions)],
      monthly: 0,
      monthlyParts: [],
      freed: freed === null ? null : roundMoney(freed),
      retained: retained === null ? null : roundMoney(retained),
      capacity,
      provider: provider.amount,
      software: software.amount,
      providerSavingsNotCounted: providerNotCounted,
      softwareSavingsNotCounted: softwareNotCounted,
      cash,
      gross: baselineMonthlyBenefit,
      baselineMonthlyBenefit,
      recurring: null,
      net: baselineMonthlyBenefit,
      payback: build !== null && baselineMonthlyBenefit > 0 ? build / baselineMonthlyBenefit : null,
      yearInvestment: build,
      yearGross: baselineMonthlyBenefit === null ? null : roundMoney(12 * baselineMonthlyBenefit),
      yearNet: build !== null && baselineMonthlyBenefit !== null
        ? roundMoney(12 * baselineMonthlyBenefit - build) : null,
      yearRoi: build > 0 && baselineMonthlyBenefit !== null
        ? roundMoney(((12 * baselineMonthlyBenefit - build) / build) * 100) : null,
      vendor: null,
      usage: workload,
      makeBudget: workload ? { low: workload.lowBudget, high: workload.highBudget } : null,
      launchSupport: rules.launchSupport,
      commercialReady: eligible && pendingUnique.length === 0,
      commercialNotice: rules.notices.estimate,
      feasibility: pendingUnique.some(item => /information conflict|information restriction/i.test(item))
        ? 'Potential blocker'
        : pendingUnique.some(item => /apps that must connect/i.test(item))
          ? 'Needs connection review' : 'Needs verification',
    };
  }

  const api = { calculate };
  if (typeof module === 'object') module.exports = api;
  else root.AOCJourneyEngine = api;
})(globalThis);
