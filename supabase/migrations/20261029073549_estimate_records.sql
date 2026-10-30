-- Keep the existing five-field form table and its submissions intact.
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  access_request_id uuid not null references public.access_requests(id) on delete restrict,
  business_area text not null check (char_length(business_area) between 1 and 100),
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 200000),
  scope_confirmed boolean not null,
  result jsonb not null check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 200000),
  calculator_version text not null check (char_length(calculator_version) between 1 and 300),
  pricing_version text not null check (char_length(pricing_version) between 1 and 300)
);
create index estimates_request_created_idx on public.estimates (access_request_id, created_at desc);
alter table public.estimates enable row level security;
revoke all on public.estimates from public, anon, authenticated, service_role;
grant insert on public.estimates to service_role;
comment on table public.estimates is 'Private server-calculated snapshots linked to a form submission, not a verified user. No browser read/write access.';
comment on column public.estimates.access_request_id is 'Server-selected submission ID from the signed intake session; never a caller-selected owner.';
notify pgrst, 'reload schema';
