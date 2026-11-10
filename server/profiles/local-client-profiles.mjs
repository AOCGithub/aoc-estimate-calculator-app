// Offline development adapter only. Production uses Supabase through the same handler.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { json } from '../api-handlers.mjs';
import { createClientProfiles } from './client-profiles.mjs';
const digest = token => createHash('sha256').update(token).digest('hex');
export const localProfileDatabasePath = join(tmpdir(), 'aoc-estimator-profiles-' + digest(process.cwd()).slice(0,12), 'profiles.sqlite');
export function createLocalClientProfiles(filename = localProfileDatabasePath, { now = Date.now, environment = {} } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(`CREATE TABLE IF NOT EXISTS client_profiles (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
    details TEXT NOT NULL CHECK(json_valid(details)),
    field_sources TEXT NOT NULL CHECK(json_valid(field_sources)),
    consent_version TEXT NOT NULL, confirmed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
  ) STRICT;`);
  if (!database.prepare('PRAGMA table_info(client_profiles)').all().some(column => column.name === 'facts')) {
    database.exec("ALTER TABLE client_profiles ADD COLUMN facts TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(facts))");
  }

  const decode = row => row ? { ...row, details: JSON.parse(row.details), facts: JSON.parse(row.facts), field_sources: JSON.parse(row.field_sources) } : null;
  const store = {
    find: (hash,time) => decode(database.prepare('SELECT * FROM client_profiles WHERE token_hash = ? AND expires_at > ?').get(hash,time)),
    expire: (hash,time) => database.prepare('DELETE FROM client_profiles WHERE token_hash = ? AND expires_at <= ?').run(hash,time),
    save(row, previous) {
      const values=[row.id,row.token_hash,JSON.stringify(row.details),JSON.stringify(row.field_sources),row.consent_version,row.confirmed_at,row.expires_at,JSON.stringify(row.facts)];
      return previous ? database.prepare('UPDATE client_profiles SET id=?,token_hash=?,details=?,field_sources=?,consent_version=?,confirmed_at=?,expires_at=?,facts=? WHERE id=? AND token_hash=? AND expires_at>?').run(...values,previous.id,row.token_hash,row.confirmed_at).changes === 1
        : database.prepare('INSERT INTO client_profiles(id,token_hash,details,field_sources,consent_version,confirmed_at,expires_at,facts) VALUES(?,?,?,?,?,?,?,?)').run(...values).changes === 1;
    },
    remove: (hash,id) => database.prepare('DELETE FROM client_profiles WHERE token_hash=? AND id=?').run(hash,id).changes === 1,
  };
  const api=createClientProfiles(store,{now,environment});
  return { handle: request => ['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname) ? api.handle(request) : json({error:'Offline adapter is local only.'},403), close:()=>database.close() };
}
