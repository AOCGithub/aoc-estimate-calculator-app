# Production Test Results

Date: 21 October 2026
Last updated: 28 October 2026
Scope: Production verification required by the Phase 1 checklist

Pricing scope: the active calculator uses the reviewed 21 October commercial rules. The live workbook was rechecked through its 24 October modification; unapproved hours, support prices, coverage, and allowances remain pending.

## Verified deployment and updates

- Confirmed `https://estimate.alwaysopencommerce.com/` loads successfully over HTTPS on 28 October 2026.
- Confirmed the production organizer returns validated structured prefill with configuration version `2026-10-21-commercial-v1`.
- Confirmed the production calculation endpoint returns server results using the same commercial version.
- The earlier domain-invalid and local-organizer-only status is historical and no longer describes the current deployment.

## Commercial server verification - 28 October 2026

Synthetic server checks confirmed:

- A fixed-price project uses the separately quoted audit amount rather than a percentage of the build.
- One eligible paid-audit credit is applied once under the 30-calendar-day acceptance and first-payment rule.
- The remaining fixed-project balance is split into two equal project payments.
- A selected Level 2 monthly build program returns the reviewed `$7,000` monthly fee, with no separate upfront build charge or fixed-project payment schedule.
- The monthly result keeps the agreed combined hours and agency blend pending when they have not been supplied by AOC.
- The server returned `2026-10-21-commercial-v1` for both routes.

All amounts entered for these checks were synthetic fixtures. They are test evidence, not approved customer quotes or package-hour entitlements.

## Earlier production UI verification - 21–22 October 2026

- Added and deployed an accessible processing state for **Organize my description**, including clear status messages, duplicate-action protection, and reduced-motion support.
- Added a short, reduced-motion-safe transition when moving between the seven form sections.
- Completed a production mobile journey and desktop rendering check with no page-level overflow under the then-current deployment.
- Verified required indicators, numeric validation, partial results for missing material scope, and server-verified results after completion.
- Completed representative Finance and billing, Customer service and returns, and Paid advertising journeys.

These earlier browser checks do not replace a final browser pass after the current commercial deployment.

## Remaining checks

- Run the full current fixed-project and monthly-program journeys in the deployed browser UI.
- Save final deployed desktop and mobile evidence for the current commercial version.
- Complete broader live AI-prefill scenarios and resolve any findings before final handoff.
- Complete physical-device sign-off on iPhone Safari and Android Chrome if required for formal acceptance.
