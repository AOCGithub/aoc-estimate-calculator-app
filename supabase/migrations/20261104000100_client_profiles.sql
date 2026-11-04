-- Optional browser-owned profiles; existing submissions/estimates are untouched.
create table public.client_profiles (
  id uuid primary key,
  created_at timestamptz not null default now(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  details jsonb not null check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 10000),
  field_sources jsonb not null check (jsonb_typeof(field_sources) = 'object' and octet_length(field_sources::text) <= 10000),
  facts jsonb not null default '{}' check (jsonb_typeof(facts) = 'object' and octet_length(facts::text) <= 35000),
  consent_version text not null,
  confirmed_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > confirmed_at)
);
create index client_profiles_expiry_idx on public.client_profiles(expires_at);
alter table public.client_profiles enable row level security;
revoke all on public.client_profiles from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.client_profiles to service_role;
comment on table public.client_profiles is 'Optional company facts, reviewed before reuse. Browser credential digest grants access; email is not a lookup or verified identity. id is the current revision.';
create function public.purge_expired_client_profiles() returns void
language sql security invoker set search_path = pg_catalog, public
as $$ delete from public.client_profiles where expires_at <= now(); $$;
revoke all on function public.purge_expired_client_profiles() from public, anon, authenticated;
grant execute on function public.purge_expired_client_profiles() to service_role;
notify pgrst, 'reload schema';
