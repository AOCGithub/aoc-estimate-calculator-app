const yesNoUnknown = [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']];

export function CommercialFields({ answers, fields }) {
  const recommended = globalThis.AOCCommercial.recommendRoute(answers.delivery_intent);
  const monthly = answers.implementation_route === 'monthly';
  return (
    <>
      <h3>Choose the delivery approach</h3>
      {fields.select('delivery_intent', 'What kind of help are you looking for?', [
        ['limited', 'A defined project or limited set of improvements'],
        ['ongoing', 'An ongoing program toward a broader connected system'],
        ['unsure', 'Help me decide'],
      ])}
      {recommended && <p className="proposed">Suggested approach: {recommended === 'project' ? 'a fixed-price project for a bounded need' : 'a monthly build program toward agreed goals'}. You can choose differently below.</p>}
      {fields.select('implementation_route', 'How would you like this implemented?', [
        ['project', 'Fixed-price project'], ['monthly', 'Monthly build program'], ['help', 'Help me decide'],
      ], 'A monthly build program is not the same as optional upkeep of a completed project.')}
      {monthly && (
        <>
          {fields.select('monthly_plan', 'Which monthly build program should we review?', [
            ['level1', 'Level 1 — $4,000/month'], ['level2', 'Level 2 — $7,000/month'], ['level3', 'Level 3 — $10,000/month'],
          ], 'Agreed assessment, builds and implementation support use the accepted human-hour allowance. No guaranteed monthly output count or automatic post-build maintenance.')}
          <details className="compact-details">
            <summary>Agreed monthly proposal details (if provided by AOC)</summary>
            <p className="helper">Leave these blank until AOC has agreed the scope and allowance. No default package hours or universal hourly rate apply.</p>
            {fields.input('agreed_monthly_hours', 'Agreed combined human hours per month', 'Use the accepted proposal, not estimated AI runtime.', 'number')}
            {fields.input('agreed_agency_blend', 'Agreed agency blend (USD/hour)', 'The single client rate agreed with AOC; not your staff cost or individual AOC role rates.', 'number')}
          </details>
          <details className="compact-details">
            <summary>Optional program value comparison</summary>
            <p className="helper">Use a common roadmap and period. Include all program months in costs, but count benefits only for the months when the process is operating. Leave the benefit timing unknown if it has not been estimated.</p>
            {fields.input('comparison_months', 'Program comparison period (months)', 'Includes implementation months within the chosen period.', 'number')}
            {fields.input('benefit_months', 'Months with operating benefits within that period', 'Zero is allowed if confirmed no operating benefits yet. No day-one benefit assumption.', 'number')}
          </details>
        </>
      )}
      {fields.select('existing_client', 'Do you already have an AOC agreement?', yesNoUnknown)}
      {answers.existing_client === 'yes' && (
        <details className="compact-details" open>
          <summary>Check the existing agreement</summary>
          <p className="helper">Use the agreed changes. Neither automatic replacement of an existing plan nor extra work within its hours is assumed.</p>
          {fields.input('existing_plan_name', 'Current agreement or plan reference')}
          {fields.input('existing_plan_fee', 'Current AOC monthly fee (USD)', '', 'number')}
          {fields.input('existing_retained_scope', 'Which existing work stays?')}
          {fields.input('existing_replaced_scope', 'Which work is replaced or removed?', 'Enter None only if explicitly confirmed.')}
          {fields.input('retained_existing_fee', 'Confirmed existing monthly fee that stays (USD)', 'Enter zero only if AOC has confirmed the entire fee is removed.', 'number')}
          {fields.select('existing_plan_reconciled', 'Has AOC confirmed these changes and checked for overlapping charges?', yesNoUnknown)}
        </details>
      )}
      <details className="compact-details" id="quote-details">
        <summary>AOC quote and audit-credit details (optional)</summary>
        <p className="helper">For an initial enquiry, leave unknown details blank. Enter only information already provided by AOC. Editing these values does not approve a quote or redeem a credit.</p>
        {fields.input('audit_fee', 'Fixed initial audit fee quoted by AOC (USD)', 'Quoted separately for either implementation route; never a percentage of the build.', 'number')}
        <details className="compact-details">
          <summary>Check an existing audit credit</summary>
          <p className="helper">Use actual calendar dates from the AOC records. Acceptance and the required first implementation payment must both be within 30 calendar days after the approved audit was sent. Exact deadlines and invoice treatment require AOC confirmation.</p>
          {fields.input('audit_paid', 'Audit fee actually paid (USD)', 'The full quoted audit fee must have been paid.', 'number')}
          {fields.input('audit_sent_date', 'Approved audit sent date', '', 'date')}
          {fields.input('implementation_acceptance_date', 'Project or program acceptance date', '', 'date')}
          {fields.input('first_implementation_payment_date', 'First implementation payment date', '', 'date')}
          {fields.select('audit_accepted_route', 'Which route do these acceptance and first-payment records belong to?', [['project','Fixed-price project'],['monthly','Monthly build program'],['unknown','Not sure']], 'Changing the selected delivery route does not transfer or duplicate a credit automatically.')}
          {fields.select('audit_credit_used', 'Has this audit credit already been applied to another route?', yesNoUnknown)}
        </details>
        {answers.implementation_route === 'project' && (
          <>
            <h3>Provided fixed-project quote</h3>
            {fields.input('preparation_fee', 'Quoted preparation/foundation fee (USD)', 'Explicit zero if included or not applicable; shared work is counted once.', 'number')}
            {fields.input('implementation_fee', 'Quoted implementation fee (USD)', 'Includes agreed build, testing, rollout and included reusable training.', 'number')}
            {fields.select('live_training', 'Has additional hands-on/live training been purchased?', [['yes', 'Yes'], ['no', 'No']])}
            {answers.live_training === 'yes' && fields.input('live_training_fee', 'Quoted additional live-training fee (USD)', 'No automatic session surcharge.', 'number')}
          </>
        )}
      </details>
    </>
  );
}
