const message = [
  '',
  '============================================================',
  'LIVE TEST REMINDER: a fictional $1,250 audit quote is enabled',
  'for Stripe sandbox testing. It is not approved AOC pricing.',
  'Remove AOC_G2_SYNTHETIC_AUDIT_QUOTE_CENTS before client release.',
  '============================================================',
  '',
].join('\n');

process.stderr.write(message);
