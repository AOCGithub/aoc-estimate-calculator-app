(function (root) {
  'use strict';
  const choices = {
    delivery_intent: ['limited', 'ongoing', 'unsure'],
    implementation_route: ['project', 'monthly', 'help'],
    monthly_plan: ['level1', 'level2', 'level3'],
    live_training: ['yes', 'no'],
    audit_credit_used: ['yes', 'no', 'unknown'],
    audit_accepted_route: ['project', 'monthly', 'unknown'],
    existing_client: ['yes', 'no', 'unknown'],
    existing_plan_reconciled: ['yes', 'no', 'unknown'],
  };
  const numericIds = [
    'audit_fee', 'audit_paid', 'preparation_fee', 'implementation_fee', 'live_training_fee',
    'agreed_monthly_hours', 'agreed_agency_blend', 'comparison_months', 'benefit_months',
    'existing_plan_fee', 'retained_existing_fee',
  ];
  const dateIds = ['audit_sent_date', 'implementation_acceptance_date', 'first_implementation_payment_date'];
  const questions = {
    delivery_intent: 'Is the goal a limited project or ongoing development toward a broader connected system?',
    implementation_route: 'Chosen implementation route (not an inferred recommendation)',
    monthly_plan: 'Explicitly selected monthly build program',
    audit_fee: 'Fixed initial audit fee explicitly quoted by AOC (USD; not a budget or percentage)',
    audit_paid: 'Actual initial audit fee paid (USD)',
    audit_sent_date: 'Calendar date the approved audit was sent (YYYY-MM-DD)',
    implementation_acceptance_date: 'Actual project/program acceptance date (YYYY-MM-DD)',
    first_implementation_payment_date: 'Actual first implementation payment date (YYYY-MM-DD)',
    audit_credit_used: 'Has this audit credit already been used toward another implementation route?',
    audit_accepted_route: 'Actual first accepted implementation route identified by the audit acceptance/payment records, not a new route recommendation',
    preparation_fee: 'AOC-quoted project preparation/foundation fee (explicit zero if included)',
    implementation_fee: 'AOC-quoted fixed project implementation fee',
    live_training: 'Was additional hands-on/live project training explicitly purchased?',
    live_training_fee: 'AOC-quoted optional live-training fee',
    agreed_monthly_hours: 'Combined human-hour allowance explicitly agreed with AOC; no automatic package entitlement',
    agreed_agency_blend: 'Single client agency blend explicitly agreed with AOC, not internal staff cost',
    comparison_months: 'Explicit total months in the program comparison period, including implementation months',
    benefit_months: 'Explicit months with operating benefits within the selected program comparison period; do not assume benefits from day one',
    existing_client: 'Does the client already have an AOC agreement?',
    existing_plan_name: 'Existing AOC agreement or plan reference',
    existing_plan_fee: 'Current AOC monthly agreement fee',
    retained_existing_fee: 'AOC-confirmed existing monthly fee that stays after the change',
    existing_retained_scope: 'Existing agreed work that stays',
    existing_replaced_scope: 'Existing agreed work replaced or removed (explicit None is allowed)',
    existing_plan_reconciled: 'Has AOC confirmed the retained/replaced scope and checked for overlap?',
  };
  const fields = Object.entries(questions).map(([id, question]) => ({
    id, question, options: choices[id]?.join(' / ') || (dateIds.includes(id) ? 'YYYY-MM-DD' : numericIds.includes(id) ? 'Explicit nonnegative number; unknown stays blank' : 'Explicit description'),
  }));
  const number = value => value === null || value === undefined || value === '' ? null
    : typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
  }
  function recommendRoute(intent) {
    return intent === 'limited' ? 'project' : intent === 'ongoing' ? 'monthly' : null;
  }
  function auditCredit(input, rules, asOf = new Date()) {
    const fee = number(input.audit_fee), paid = number(input.audit_paid);
    const sent = date(input.audit_sent_date), accepted = date(input.implementation_acceptance_date), firstPaid = date(input.first_implementation_payment_date);
    const deadline = sent ? new Date(sent.getTime() + rules.auditCreditDays * 86400000) : null;
    const expiryDate = deadline?.toISOString().slice(0, 10) || null;
    const result = (status, amount, reason) => ({ status, amount, expiryDate, reason });
    if (input.audit_credit_used === 'yes') return result('already_used', 0, 'The audit credit has already been applied; changing route does not create another credit.');
    if (deadline && ((accepted && accepted > deadline) || (firstPaid && firstPaid > deadline))) return result('expired', 0, 'Acceptance and first implementation payment must both fall within the 30-calendar-day window.');
    const today = date(asOf.toISOString().slice(0, 10));
    if (deadline && today > deadline && (!accepted || !firstPaid)) return result('expired', 0, 'The credit window has expired without both qualifying events recorded.');
    if (!fee || paid === null || !sent || !accepted || !firstPaid || input.audit_credit_used !== 'no') return result('pending', null, 'AOC must confirm the quoted/paid audit, dates, and that the credit has not been used.');
    if (paid !== fee) return result(paid > fee ? 'review' : 'pending', null, 'The full paid audit fee must match the quoted fee; partial or excess payments need review.');
    if (accepted < sent || firstPaid < sent || accepted > today || firstPaid > today || sent > today) return result('review', null, 'Use actual qualifying dates after the approved audit was sent; AOC must confirm chronology.');
    if (!['project','monthly'].includes(input.audit_accepted_route)) return result('pending', null, 'AOC must confirm which implementation route the actual acceptance and first-payment records belong to.');
    if (input.audit_accepted_route !== input.implementation_route) return result('review', null, 'These audit acceptance/payment records belong to a different route. Changing route does not authorize another credit; AOC must reconcile it.');
    return result('eligible', fee, 'Full paid audit fee eligible once toward the first accepted implementation route; AOC confirms invoice application.');
  }
  function apply(input, draft, rules, options = {}) {
    const errors = [...draft.errors], review = [], warnings = [...draft.warnings].filter(message => !/Agent upkeep|Ongoing delivery volumes|Requested urgent coverage/.test(message));
    const route = ['project', 'monthly'].includes(input.implementation_route) ? input.implementation_route : null;
    const credit = auditCredit(input, rules, options.asOf || new Date());
    const audit = number(input.audit_fee);
    if (!audit) review.push('Initial audit: AOC must quote and agree a positive fixed fee; it is not a build percentage.');
    if (!route) review.push('Choose a fixed-price project or monthly build program, or ask AOC to recommend a route.');
    if (!['limited', 'ongoing'].includes(input.delivery_intent)) review.push('Confirm the delivery goal so AOC can explain the appropriate project/program recommendation.');
    if (['area6','area7','area8','area9','area10'].includes(input.area)) {
      if (!['maintenance','managed'].includes(input.delivery_mode)) review.push('Confirm whether recurring marketing production is included or only operation of the agreed system.');
      if (input.delivery_mode === 'managed' && (input.area === 'area8'
        ? number(input.monthly_pages) === null || number(input.monthly_articles) === null : number(input.monthly_outputs) === null)) review.push('Recurring production volumes need review against the accepted scope and capacity; no output entitlement or extra fee is inferred.');
    }
    if (credit.amount === null) review.push(credit.reason);
    const prep = number(input.preparation_fee), implementation = number(input.implementation_fee);
    const training = input.live_training === 'no' ? 0 : input.live_training === 'yes' ? number(input.live_training_fee) : null;
    const quotedBuild = prep !== null && implementation !== null && implementation > 0 && training !== null ? round(prep + implementation + training) : null;
    const planFee = route === 'monthly' ? rules.monthlyPlans[input.monthly_plan] ?? null : null;
    const hours = number(input.agreed_monthly_hours), blend = number(input.agreed_agency_blend);
    let monthly = route === 'monthly' ? planFee : route === 'project'
      ? input.management === 'no' ? 0 : input.management === 'yes' ? number(rules.supportPrices[input.tier]) : null : null;
    if (route === 'project' && quotedBuild === null) review.push('Project quote: preparation, implementation, and any accepted optional live training need AOC confirmation. Existing build coefficients are provisional only.');
    if (route === 'project' && monthly === null) review.push('Optional project operation/support: agree the management choice and fee. No approved price is configured; clients cannot set this fee.');
    if (route === 'monthly') {
      if (planFee === null) review.push('Select an approved monthly build program.');
      if (!hours || !blend) review.push('Monthly program: agreed combined human hours and a single agreed client agency blend are still needed; no default hours or flat rate.');
      if (planFee !== null && hours && blend && Math.abs(hours * blend - planFee) > 1) review.push('Monthly fee, agreed hours and agency blend need reconciliation with the accepted proposal; staffing changes do not reprice it automatically.');
      warnings.push('Monthly work includes agreed assessment, builds and implementation support; no separate charge for included project work or automatic post-build maintenance tier.');
    }
    if (input.existing_client !== 'yes' && input.existing_client !== 'no') review.push('Confirm whether an existing AOC agreement must be reconciled.');
    const currentFee = number(input.existing_plan_fee), retainedFee = number(input.retained_existing_fee);
    const existingReady = input.existing_client === 'no' || (input.existing_client === 'yes'
      && input.existing_plan_reconciled === 'yes' && currentFee !== null && retainedFee !== null && retainedFee <= currentFee
      && Boolean(input.existing_plan_name?.trim()) && Boolean(input.existing_retained_scope?.trim()) && Boolean(input.existing_replaced_scope?.trim()));
    if (input.existing_client === 'yes' && !existingReady) review.push('Existing AOC agreement: confirm the plan, current fee, retained/replaced scope, retained fee and overlap review before relying on combined pricing or ROI.');
    if (currentFee !== null && retainedFee !== null && retainedFee > currentFee && input.existing_client === 'yes') review.push('The retained existing fee exceeds the current fee; confirm separately accepted changes.');
    const combinedMonthlyCommitment = existingReady && monthly !== null
      ? round(monthly + (input.existing_client === 'yes' ? retainedFee : 0)) : null;
    const replacement = (current, portion, part) => portion === 'none' ? 0 : portion === 'all' ? number(current) : portion === 'part' ? number(part) : null;
    const provider = replacement(input.replacement_provider_cost, input.provider_replaced_portion, input.provider_removed_amount);
    const software = replacement(input.software_replaced_cost, input.software_replaced_portion, input.software_removed_amount);
    for (const [total, saved, label] of [[number(input.replacement_provider_cost), provider, 'Provider'], [number(input.software_replaced_cost), software, 'Software']]) {
      if (total !== null && saved !== null && saved > total && !errors.includes(`${label} savings cannot exceed current cost.`)) errors.push(`${label} savings cannot exceed current cost.`);
    }
    const cash = provider === null || software === null ? null : round(provider + software);
    const recurring = monthly === null || draft.vendor === null ? null : round(monthly + draft.vendor);
    const gross = draft.capacity === null || cash === null ? null : round(draft.capacity + cash);
    const net = errors.length || !existingReady || recurring === null || gross === null ? null : round(gross - recurring);
    let projectBalance = null, firstProjectPayment = null, secondProjectPayment = null;
    let initialSpend = null, monthlyInvoiceAfterCredit = null;
    if (route === 'project' && quotedBuild !== null && credit.amount !== null) {
      if (credit.amount > quotedBuild) review.push('Audit credit exceeds the project price; AOC must resolve this without a negative invoice or invented refund rule.');
      else {
        projectBalance = round(quotedBuild - credit.amount);
        firstProjectPayment = round(projectBalance * rules.projectFirstPaymentFraction);
        secondProjectPayment = round(projectBalance - firstProjectPayment);
        if (audit) initialSpend = round(quotedBuild + audit - credit.amount);
      }
    }
    if (route === 'monthly' && planFee !== null && credit.amount !== null) {
      if (credit.amount > planFee) review.push('Audit credit exceeds the first monthly fee; invoice handling needs AOC review. Do not assume a refund or carry-over.');
      else monthlyInvoiceAfterCredit = round(planFee - credit.amount);
    }
    const requestedMonths = number(input.comparison_months);
    const months = route === 'project' ? 12 : requestedMonths && Number.isInteger(requestedMonths) ? requestedMonths : null;
    if (route === 'monthly' && months === null) warnings.push('Optional ROI: choose a program comparison period and comparable milestones before relying on the period illustration.');
    const benefitMonths = route === 'project' ? 12 : number(input.benefit_months);
    if (route === 'monthly' && benefitMonths === null) warnings.push('Optional ROI: confirm how many months have operating benefits within the program period. Benefits are not assumed from day one.');
    if (route === 'monthly' && months !== null && benefitMonths !== null && benefitMonths > months) errors.push('Months with benefits cannot exceed the comparison period.');
    const upfront = route === 'project' ? initialSpend : route === 'monthly' && audit && credit.amount !== null && monthlyInvoiceAfterCredit !== null ? round(audit - credit.amount) : null;
    const investment = !existingReady || upfront === null || recurring === null || months === null ? null : round(upfront + months * recurring);
    const periodGross = gross === null || months === null || benefitMonths === null || benefitMonths > months ? null : round(benefitMonths * gross);
    const periodNet = investment === null || periodGross === null || errors.length ? null : round(periodGross - investment);
    const blockers = [...draft.pending, ...review];
    const unsafe = draft.build === null || errors.length > 0 || draft.feasibility === 'Potential blocker' || draft.feasibility === 'Needs connection review';
    if (unsafe) { projectBalance = firstProjectPayment = secondProjectPayment = monthlyInvoiceAfterCredit = initialSpend = null; }
    return {
      ...draft, errors, warnings: [...new Set(warnings)], pending: [...new Set(blockers)], route, coverage: null,
      routeRecommendation: recommendRoute(input.delivery_intent), commercialReady: !unsafe && blockers.length === 0,
      build: unsafe || route === 'monthly' ? null : quotedBuild ?? draft.build,
      lines: route === 'monthly' ? [] : draft.lines, known: route === 'monthly' ? null : draft.known,
      provisionalBuild: route === 'monthly' ? null : draft.build, buildQuoted: quotedBuild !== null && route === 'project',
      low: route === 'monthly' ? null : quotedBuild !== null && route === 'project' ? quotedBuild : draft.low,
      high: route === 'monthly' ? null : quotedBuild !== null && route === 'project' ? quotedBuild : draft.high,
      audit: audit > 0 ? audit : null, credit, projectBalance, firstProjectPayment, secondProjectPayment,
      monthly, monthlyDraft: route === 'project' && monthly > 0, monthlyParts: [], planFee, monthlyInvoiceAfterCredit,
      agreedMonthlyHours: hours > 0 ? hours : null, agreedAgencyBlend: blend > 0 ? blend : null,
      combinedMonthlyCommitment, existingPlanReconciled: existingReady,
      provider, software, cash, recurring, gross, net, initialSpend: unsafe ? null : initialSpend,
      comparisonMonths: months, benefitMonths, comparisonInvestment: unsafe ? null : investment,
      comparisonGross: periodGross, comparisonNet: unsafe ? null : periodNet,
      yearInvestment: !unsafe && months === 12 ? investment : null,
      yearGross: months === 12 ? periodGross : null, yearNet: !unsafe && months === 12 ? periodNet : null,
      payback: !unsafe && route === 'project' && initialSpend !== null && net > 0 ? initialSpend / net : null,
      auditPurchasable: false, commercialNotice: rules.notice,
    };
  }
  const api = { fields, choices, numericIds, dateIds, date, recommendRoute, auditCredit, apply };
  if (typeof module === 'object') module.exports = api; else root.AOCCommercial = api;
})(globalThis);
