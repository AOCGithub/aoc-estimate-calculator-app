# AOC calculator maintenance guide

Updated: 6 November 2026

## How entry and saving work

Visitors enter their name, company, website, role and business email to open the calculator. All five fields are required. Verification and approval are currently paused.

Both saving options start unchecked:

- **Remember my business details:** saves details for review and reuse in the same browser.
- **Save my details and estimates with AOC:** saves the form submission and calculated results.

Visitors can choose either, both or neither. Choosing neither saves no new records at entry or calculation. Visitors can still separately choose to save company facts in a profile inside the calculator.

Remembered profiles expire 30 days after the latest save. Forgetting a profile does not delete separately saved estimates. Clients can download their current estimate; viewing past estimates inside the app is not available yet.

## Find saved client information

In Supabase, open **Table Editor**:

1. Open **access_requests** and search the client's **business_email**.
2. Copy the matching record's **id**.
3. Open **estimates** and filter **access_request_id** using that ID.
4. Open **answers** and **result** to view the responses and calculation.

Check every matching submission if the client entered the form more than once. Optional remembered details and company facts are in **client_profiles**.

## Make a form or pricing change

1. Give the developer the approved wording, question or pricing change and its source document.
2. The developer applies it and tests the affected form and calculations.
3. Publish the tested update through GitHub and Vercel, then check it on the live website.
4. Record what changed and the test result in [Production Test Results](PRODUCTION-TEST-RESULTS.md).

**Editing the pricing spreadsheet does not automatically update the website.** Missing prices should stay marked as unknown until supplied.

## Check after an update

- Blank required fields block entry; corrected answers allow entry.
- Each saving choice stores the right information in Supabase.
- Reviewing saved details preserves current edits.
- Calculations update after answers change or are cleared.
- Ending the session clears the current answers and returns to the entry form.
- The journey works on desktop and mobile.

Ask the developer to run the saving-failure and access-protection checks too. Keep AI and database keys in Vercel's private server settings.

Developer details: [pricing/forms](PRICING-AND-FORM-MAINTENANCE.md) and [profiles](features/OPTIONAL-CLIENT-PROFILES.md).

## Still on hold

The AOC website link/button and the website-to-calculator test are deferred. Verification and AOC approval remain paused. Changing a submission's review status currently does not control access.
