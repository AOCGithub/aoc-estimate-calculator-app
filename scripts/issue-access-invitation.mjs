import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { issueInvitation } from '../server/invitation-issuer.mjs';

const requestId = process.argv[2];
const local = process.argv.includes('--local');
if (!local && process.env.AOC_MANUAL_ACCESS_ENABLED !== 'true') {
  throw new Error('Live manual access is not enabled. Use --local for the approved local trial.');
}
const connection = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connection) throw new Error('Run through Vercel env run to inject database credentials.');
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 15, ssl: 'require' });
try {
  const invitation = await issueInvitation(sql, requestId, {
    baseURL: local ? 'http://localhost:5173' : process.env.AOC_ACCESS_PUBLIC_URL,
  });
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  const name = `access-invitation-${requestId}-${randomUUID().slice(0, 8)}.txt`;
  await writeFile(new URL('../artifacts/' + name, import.meta.url),
    `PRIVATE — share only with the approved visitor. This is not email ownership verification.\nRequest: ${requestId}\nExpires: ${new Date(invitation.expiresAt).toISOString()}\n\n${invitation.url}\n`,
    { flag: 'wx', mode: 0o600 });
  console.log(`Created one private link in artifacts/${name}. No email was sent. Do not commit or share the file publicly.`);
} catch (error) {
  console.error(error.code ? 'Invitation creation failed: ' + error.code : error.message);
  process.exitCode = 1;
} finally { await sql.end({ timeout: 5 }); }
