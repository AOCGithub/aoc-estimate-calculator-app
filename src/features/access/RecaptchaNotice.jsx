export function RecaptchaNotice({ enabled }) {
  return enabled ? <p className="recaptcha-notice">
    This site is protected by reCAPTCHA and the Google{' '}
    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
    <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
  </p> : null;
}
