// Explicit opt-in for sending Stripe sandbox confirmation emails from local development.
// The regular `dev:g2` command always captures email to disk instead.
process.env.AOC_G2_LOCAL_EMAIL_MODE = 'send';
await import('./dev-g2.mjs');
