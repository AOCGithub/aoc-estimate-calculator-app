import nodemailer from 'nodemailer';

const guid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const graphScope = 'https://graph.microsoft.com/.default';

function deliveryError(state) {
  return Object.assign(new Error('microsoft_mail_' + state), {deliveryState: state});
}

export function createMicrosoftMailTransport({tenantId, clientId, clientSecret, mailboxId}, request = fetch) {
  if (!guid.test(tenantId || '') || !guid.test(clientId || '') || !guid.test(mailboxId || '') || !clientSecret) {
    throw new Error('microsoft_mail_config_incomplete');
  }
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const sendUrl = `https://graph.microsoft.com/v1.0/users/${mailboxId}/sendMail`;
  const mime = nodemailer.createTransport({streamTransport: true, buffer: true, newline: 'windows',
    disableFileAccess: true, disableUrlAccess: true});
  let token;
  let pendingToken;

  async function authorize() {
    const response = await request(tokenUrl, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({client_id: clientId, client_secret: clientSecret,
        scope: graphScope, grant_type: 'client_credentials'}),
    });
    if (!response.ok) throw new Error('microsoft_token_rejected');
    const data = await response.json();
    const lifetime = Number(data.expires_in);
    if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(lifetime) || lifetime <= 0) {
      throw new Error('microsoft_token_invalid');
    }
    token = {value: data.access_token, expiresAt: Date.now() + Math.max(0, lifetime - 60) * 1000};
    return token.value;
  }

  function accessToken() {
    if (token && token.expiresAt > Date.now()) return token.value;
    pendingToken ||= authorize().finally(() => { pendingToken = null; });
    return pendingToken;
  }

  return {
    async sendMail(message) {
      let bearer;
      let composed;
      try {
        bearer = await accessToken();
        composed = await mime.sendMail(message);
      } catch {
        // No submission to Exchange has been attempted yet.
        throw deliveryError('retry');
      }
      let response;
      try {
        response = await request(sendUrl, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
          headers: {Authorization: `Bearer ${bearer}`, 'Content-Type': 'text/plain'},
          body: composed.message.toString('base64'),
        });
      } catch {
        // Exchange may have accepted the message before the connection was lost.
        throw deliveryError('uncertain');
      }
      if (response.status === 202) return {accepted: composed.envelope.to};
      await response.body?.cancel();
      if (response.status === 401) token = null;
      if ([401, 403, 429].includes(response.status)) throw deliveryError('retry');
      throw deliveryError(response.status >= 500 ? 'uncertain' : 'failed');
    },
  };
}
