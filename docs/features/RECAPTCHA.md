# Entry bot protection

Google reCAPTCHA protects the business-details form. The app supports the visible v2 checkbox and the existing background v3 check. It does not verify email ownership or enable AOC approval. The existing fields, independent saving choices, calculator and pricing rules are preserved.

Production selects the v2 checkbox using `RECAPTCHA_VERSION=v2`. Google decides whether a visitor also needs an image challenge; accepting the checkbox alone is normal.

## Configuration

In Vercel's production environment, set:

- `VITE_RECAPTCHA_SITE_KEY`: public site key registered for the hostname visitors use.
- `RECAPTCHA_SECRET_KEY`: private server-only secret for that same key. Never commit it or prefix it with `VITE_`.
- `RECAPTCHA_VERSION=v2`: selects the visible checkbox. Without this setting, existing v3 deployments keep their current behavior. Use matching keys for the chosen version.

Both keys enable the check automatically. Incomplete configuration blocks new entry. The browser gets only the public configuration from `/api/access/status`; it never receives the secret. Redeploy after changing Vercel variables. Register every production hostname that should accept direct entry, and use separate keys for test environments.

The public Vercel entry URL redirects to the registered AOC hostname. The two internal stable aliases retain Vercel sign-in protection; after that check, the same entry redirect applies. App redirect rules preserve API and asset paths. Use the AOC domain for client entry; preview keys remain separate.

For v3, the security threshold defaults to Google's suggested starting score of `0.5`. A server-only `RECAPTCHA_MIN_SCORE` can tune it after reviewing actual traffic. v2 checks the solved challenge instead of a score. Avoid lowering v3 thresholds merely to make automated browser tests pass. To roll back CAPTCHA enforcement while investigating an outage, explicitly set `AOC_RECAPTCHA_ENABLED=false` and redeploy; the existing form/session guards remain.

### Configure the visible checkbox

1. Register a new **Challenge (v2) → I'm not a robot checkbox** key for `estimate.alwaysopencommerce.com`. Keep the existing v3 registration for rollback.
2. After the v2 implementation is tested, replace the two Vercel production key values with the matching v2 pair and add `RECAPTCHA_VERSION=v2`. Redeploy the tested code and settings together.
3. On the AOC domain, check the visible checkbox, rejection when unchecked, successful entry, retry and calculation. Google decides when an additional image challenge is needed.

Use Google's published v2 test keys only in isolated local widget tests. They always pass and must never protect production.

## Visitor flow

1. Complete the same five required fields and choose either, both or neither saving option.
2. With v2, tick the visible checkbox before Continue. Expired or failed checks require a fresh attempt; narrow screens use Google's compact widget. With v3, Continue generates a fresh background `calculator_entry` token.
3. Before saving a submission or creating a session, the server verifies Google's success and exact request hostname. Google enforces single use and two-minute token expiry. v3 also requires the expected action, score and timestamp; v2 does not return a v3 score/action. The v2 timestamp records challenge loading, so filling the form slowly does not itself invalidate a newly solved checkbox. Invalid or unavailable checks cannot open the calculator.
4. After successful entry verification, optional profile saving uses that signed session. A direct anonymous profile POST cannot bypass the check. Profile review and deleting an owned profile remain available before entry.

Failures keep the entered details and choices visible and allow a fresh retry. A v2 submission consumes and resets the checkbox, including after a failed profile save; expiry clears its token. A timeout or a late response cannot silently complete a failed attempt. CAPTCHA tokens and verification scores are not stored with submissions, profiles or estimates.

The entry page includes Google's Privacy Policy and Terms links; the floating badge is hidden under Google's permitted disclosure alternative. Google may use its own necessary browser storage/cookie for bot detection, independently of AOC's optional database saving. CSP permits the required Google scripts, connections and frames.

## Checks and maintenance

- `npm test` includes `npm run test:recaptcha`: shared v2/v3 Node/Worker validation, manual-review compatibility, protected profile writes and desktop/mobile saving-choice browser cases with synthetic providers. Unchecked/expired challenges, provider/SDK failures, timeouts, late results, fresh retries, profile-save failures and calculation are covered without real Google requests.
- `npm run dev` and `npm run dev:profiles` explicitly disable CAPTCHA only in the local preview process because production keys do not cover localhost. Production variables are not changed.
- `npm run test:profiles:cloud-ui` checks actual Supabase through local handlers with CAPTCHA explicitly off; the separate CAPTCHA suite covers enforcement. Only synthetic database records are removed.
- On the deployed AOC domain, confirm the disclosure, successful normal entry, preserved choices and calculation. A direct entry POST without a token must fail. v2 may require a human to complete an image challenge; v3 headless browsers can receive low scores. Real-browser acceptance remains distinct from simulated provider tests.

Google's Essentials allowance is shared across the organization. Without billing, quota exhaustion blocks verification rather than granting free access. Check usage in Google's console; creating keys alone does not confirm billing settings.

References: [v2 checkbox](https://developers.google.com/recaptcha/docs/display), [v3 integration](https://developers.google.com/recaptcha/docs/v3), [server verification](https://developers.google.com/recaptcha/docs/verify), [branding/CSP/testing](https://developers.google.com/recaptcha/docs/faq), [billing](https://docs.cloud.google.com/recaptcha/docs/billing-information).
