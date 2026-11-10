// Real-provider journeys use the normal Google checkbox, never a CAPTCHA bypass.
export async function completeRecaptcha(page, configuration) {
  if (!configuration?.enabled || configuration.version !== 'v2') return;
  const frame = page.frameLocator('iframe[title="reCAPTCHA"]');
  const checkbox = frame.getByRole('checkbox', { name: "I'm not a robot", exact: true });
  if (await checkbox.getAttribute('aria-checked') !== 'true') await checkbox.click();
  try {
    await frame.locator('[role="checkbox"][aria-checked="true"]').waitFor({ timeout: 20000 });
  } catch {
    throw new Error('The live Google checkbox did not complete. A human challenge or connection issue may need checking in a normal browser; CAPTCHA was not bypassed.');
  }
}
