export const auditNextStep = 'Before we start, we’ll let you know what we need from you and when you can expect your audit report.';

export const paymentOutcomes = {
  pending: ['Payment not confirmed', 'Check the payment status before trying again. We’ve saved your answers.'],
  processing: ['Payment processing', 'Stripe is still processing your payment. Check again in a moment.'],
  paid: ['Payment received', 'Thanks for your payment. ' + auditNextStep],
  failed: ['Payment failed', 'Stripe couldn’t complete the payment. Your answers are saved, so you can try again.'],
  incomplete: ['Checkout not completed', 'We’ve saved your answers. You can pick up where you left off when you’re ready to pay.'],
};

export const sandboxNotice = 'Stripe test mode. No real charge or audit booking.';
