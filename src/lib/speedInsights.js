export const performanceOrigin = 'https://estimate.alwaysopencommerce.com';

// This calculator has one page. Never report query strings, fragments or form data.
export function sanitizePerformanceEvent(event) {
  try {
    if (new URL(event.url).origin !== performanceOrigin) return null;
    return { ...event, url: `${performanceOrigin}/`, route: '/' };
  } catch {
    return null;
  }
}
