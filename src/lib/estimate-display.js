// Explain missing figures using the saved answers and calculation output.
// The calculator remains the source of every numeric result.
import { money } from './format.js';

export function describeEstimate(result, answers) {
  const optionalValueInputsMissing = result.capacity == null || result.baselineMonthlyBenefit == null;
  const support = result.launchSupport?.status === 'proposed'
    ? 'Proposed one-time item; terms not finalized'
    : 'Not included';
  const ongoing = result.recurring == null ? 'Not included in this estimate' : money(result.recurring);

  let roiNote = '';
  if (result.net == null) {
    if (result.errors?.length) roiNote = 'Review the entered values before using the ROI figures.';
    else if (optionalValueInputsMissing) roiNote = 'ROI not estimated because positive monthly hours and hourly cost are required.';
    else roiNote = 'AOC needs to review the inputs before ROI can be estimated.';
  }

  let payback = null;
  if (result.payback != null) payback = result.payback.toFixed(1) + ' months';
  else if (result.net != null && result.net <= 0) payback = 'No payback under these assumptions';

  const paybackNote = result.net != null
    ? 'Payback and first-year illustrations use the build estimate only; they exclude the separate paid-service fee and any conditional credit.'
    : '';
  return { support, ongoing, optionalValueInputsMissing, roiNote, payback, paybackNote };
}
