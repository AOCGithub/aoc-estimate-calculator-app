// Explain missing figures using the saved answers and calculation output.
// The calculator remains the source of every numeric result.
import { money } from './format.js';

export function describeEstimate(result, answers) {
  const monthlyProgram = result.route === 'monthly';
  const project = result.route === 'project';
  const requestedSupport = ['aoc', 'shared'].includes(answers.responsibility_split)
    || (!answers.responsibility_split && answers.management === 'yes');
  const clientOperated = answers.responsibility_split === 'client'
    || (!answers.responsibility_split && answers.management === 'no');
  const supportQuoteNeeded = project && result.monthly == null && requestedSupport;
  const supportNotIncluded = project && result.monthly === 0 && clientOperated;
  const agreementPending = answers.existing_client === 'yes' && !result.existingPlanReconciled;
  const optionalValueInputsMissing = result.capacity == null || result.cash == null || result.vendor == null;

  let support = 'Support arrangement not specified';
  if (monthlyProgram) support = result.planFee == null ? 'Monthly program fee to be confirmed' : 'Included in the program fee';
  else if (supportNotIncluded) support = 'Ongoing AOC support not included';
  else if (result.monthly != null) support = money(result.monthly) + ' / month';
  else if (supportQuoteNeeded) support = 'Support fee to be quoted by AOC';

  let ongoing = 'Software costs not provided';
  if (result.recurring != null) ongoing = money(result.recurring);
  else if (result.monthly == null) ongoing = project || monthlyProgram ? support : 'Confirm the implementation route';

  let roiNote = '';
  if (result.net == null) {
    if (result.errors?.length) roiNote = 'Review the entered values before using the ROI figures.';
    else if (optionalValueInputsMissing) roiNote = 'ROI not estimated because optional time or cost details were not provided.';
    else if (agreementPending) roiNote = 'ROI can be estimated after AOC confirms the changes to your existing agreement.';
    else if (supportQuoteNeeded) roiNote = 'ROI can be estimated after AOC quotes the support fee.';
    else if (project && result.monthly == null) roiNote = 'ROI can be estimated after the support arrangement and any fee are confirmed.';
    else if (result.route == null) roiNote = 'ROI can be estimated after the implementation route is confirmed.';
    else if (result.monthly == null) roiNote = 'ROI can be estimated after the monthly program fee is confirmed.';
    else if (result.existingPlanReconciled === false) roiNote = 'Confirm whether you have an existing AOC agreement to estimate ROI.';
    else roiNote = 'AOC needs to review the inputs before ROI can be estimated.';
  }

  let payback = null;
  let paybackNote = '';
  if (project) {
    if (result.payback != null) payback = result.payback.toFixed(1) + ' months';
    else if (result.net != null && result.net <= 0) payback = 'No payback under these assumptions';
    else if (result.net != null) {
      const outstanding = [
        (!result.buildQuoted || result.build == null) && 'project scope and quote',
        result.audit == null && 'audit fee',
        result.credit?.amount == null && 'audit credit',
      ].filter(Boolean);
      paybackNote = outstanding.length
        ? 'Payback can be estimated after AOC confirms the ' + outstanding.join(', ') + '.'
        : 'AOC needs to review the project costs before payback can be estimated.';
    }
  }

  return { support, ongoing, supportNotIncluded, requestedSupport, agreementPending,
    optionalValueInputsMissing, roiNote, payback, paybackNote };
}
