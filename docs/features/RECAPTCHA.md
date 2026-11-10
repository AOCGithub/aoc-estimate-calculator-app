# Entry bot protection

Google reCAPTCHA v3 runs on the business-details form. It does not verify email ownership or enable AOC approval. The existing fields, independent saving choices, calculator and pricing rules are preserved.

## Configuration

In Vercel's production environment, set:

- `VITE_RECAPTCHA_SITE_KEY`: public v3 site key registered for the hostname visitors use.
- `RECAPTCHA_SECRET_KEY`: private server-only secret for that same key. Never commit it or prefix it with `VITE_`.

Both keys enable the check automatically. Incomplete configuration blocks new entry. The browser gets only the public configuration from `/api/access/status`; it never receives the secret. Redeploy after changing Vercel variables. Register every production hostname that should accept direct entry, and use separate keys for test environments.

The public Vercel entry URL redirects to the registered AOC hostname. The two internal stable aliases retain Vercel sign-in protection; after that check, the same entry redirect applies. App redirect rules preserve API and asset paths. Use the AOC domain for client entry; preview keys remain separate.

The security threshold defaults to Google's suggested starting score of `0.5`. A server-only `RECAPTCHA_MIN_SCORE` can tune it after reviewing actual traffic. Avoid lowering it merely to make automated browser tests pass. To roll back CAPTCHA enforcement while investigating an outage, explicitly set `AOC_RECAPTCHA_ENABLED=false` and redeploy; the existing form/session guards remain.

## Visitor flow

1. Complete the same five required fields and choose either, both or neither saving option.
2. Click Continue. The button shows Checking security while a fresh `calculator_entry` token is generated.
3. Before saving a submission or creating a session, the server verifies Google's result, score, expected action, exact request hostname and two-minute freshness. Invalid, expired/reused, low-score or unavailable checks cannot open the calculator.
4. After successful entry verification, optional profile saving uses that signed session. A direct anonymous profile POST cannot bypass the check. Profile review and deleting an owned profile remain available before entry.

Failures keep the entered details and choices visible and allow a fresh retry. A timeout or a late response cannot silently complete a failed attempt. CAPTCHA tokens and verification scores are not stored with submissions, profiles or estimates.

The entry page includes Google's Privacy Policy and Terms links; the floating badge is hidden under Google's permitted disclosure alternative. Google may use its own necessary browser storage/cookie for bot detection, independently of AOC's optional database saving. CSP permits the required Google scripts, connections and frames.

## Checks and maintenance

- `npm test` includes `npm run test:recaptcha`: shared Node/Worker validation, manual-review compatibility, protected profile writes and eight desktop/mobile saving-choice browser cases with synthetic providers. Provider/SDK failures, timeouts, late results, fresh retries, profile-save failures and calculation are covered without real Google requests.
- `npm run dev` and `npm run dev:profiles` explicitly disable CAPTCHA only in the local preview process because production keys do not cover localhost. Production variables are not changed.
- `npm run test:profiles:cloud-ui` checks actual Supabase through local handlers with CAPTCHA explicitly off; the separate CAPTCHA suite covers enforcement. Only synthetic database records are removed.
- On the deployed AOC domain, confirm the disclosure, successful normal entry, preserved choices and calculation. A direct entry POST without a token must fail. Headless browsers can receive low scores; physical-browser acceptance remains distinct from simulated provider tests.

Google's Essentials allowance is shared across the organization. Without billing, quota exhaustion blocks verification rather than granting free access. Check usage in Google's console; creating keys alone does not confirm billing settings.

References: [v3 integration](https://developers.google.com/recaptcha/docs/v3), [server verification](https://developers.google.com/recaptcha/docs/verify), [branding/CSP/testing](https://developers.google.com/recaptcha/docs/faq), [billing](https://docs.cloud.google.com/recaptcha/docs/billing-information).
