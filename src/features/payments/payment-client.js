export const paymentStatusPath = '/payment/status';

export function isPaymentStatusLocation(location) {
  return location.pathname === paymentStatusPath || location.pathname === paymentStatusPath + '/'
    || (location.pathname === '/' && new URLSearchParams(location.search).has('purchase_reference'));
}

export function paymentStatusUrl(reference, submissionReference) {
  return paymentStatusPath + '?' + new URLSearchParams({ purchase_reference: reference,
    ...(submissionReference ? { audit_request: submissionReference } : {}) });
}

export function calculatorReturnUrl(location) {
  const params = new URLSearchParams(location.search);
  params.delete('purchase_reference');
  params.delete('checkout_result');
  return '/' + (params.size ? '?' + params : '') + location.hash;
}

export function stripeLink(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export async function readPaymentStatus({ reference, refresh = false, signal } = {}) {
  const query = new URLSearchParams();
  if (reference) query.set('purchase_reference', reference);
  if (refresh && reference) query.set('refresh', 'true');
  const response = await fetch('/api/payments/status' + (query.size ? '?' + query : ''), {
    credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    const error = new Error(body?.error || 'We could not load your payment details. Please try again.');
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function readAuditQuote(submissionReference, { signal } = {}) {
  const query = new URLSearchParams({ submission_reference: submissionReference });
  const response = await fetch('/api/payments/status?' + query, {
    credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.quoteRequest) throw new Error(body?.error || 'We could not check the saved audit fee. Please try again.');
  return body.quoteRequest;
}

export async function requestAuditQuote(body) {
  const response = await fetch('/api/payments/quote-request', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.quoteRequest?.submissionReference) {
    throw new Error(data?.error || 'The audit review request could not be saved. Please try again.');
  }
  return data.quoteRequest;
}

export async function startAuditCheckout(body) {
  const response = await fetch('/api/payments/checkout', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.purchase?.purchaseReference) {
    throw new Error(data?.error || 'Checkout could not be opened. Please try again.');
  }
  return data;
}
