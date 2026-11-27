# Entry bot protection

Status: operational
Reviewed: 25 November 2026

Google reCAPTCHA protects the five-field entry form. Production uses the visible v2 checkbox. reCAPTCHA is bot protection, not email ownership verification or AOC approval.

## Configuration

- `VITE_RECAPTCHA_SITE_KEY`: public site key for the production hostname.
- `RECAPTCHA_SECRET_KEY`: matching server-only secret.
- `RECAPTCHA_VERSION=v2`: visible checkbox selection.

Incomplete or mismatched configuration blocks new entry. Never expose the secret with a `VITE_` prefix. Redeploy after variable changes and register each permitted production hostname.

## Server checks

The server verifies provider success and exact hostname before saving a submission or creating a session. Tokens are single-use and expire. Failed/expired checks retain editable form data and require a fresh attempt. Tokens and scores are not stored with client records.

Local preview commands explicitly disable real CAPTCHA because production keys do not cover localhost. This does not change production variables.

## Verification

Run `npm run test:recaptcha`. On production, verify checkbox disclosure, unchecked rejection, successful human entry and preserved saving choices. A direct entry request without a valid token must fail. Google may require an image challenge; headless automation is not a substitute for a normal-browser check.
