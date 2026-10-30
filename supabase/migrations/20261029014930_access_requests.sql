-- Access review records only. Calculator answers and reusable profiles are not stored.
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  company text not null check (char_length(company) between 2 and 120),
  website text not null check (char_length(website) between 1 and 500),
  role text not null check (char_length(role) between 2 and 100),
  business_email text not null check (char_length(business_email) between 3 and 254),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed'))
);

alter table public.access_requests enable row level security;
revoke all on public.access_requests from public, anon, authenticated, service_role;
-- The application can submit requests, but cannot list or edit anyone's details.
grant insert on public.access_requests to service_role;
-- No browser policies: review is done by AOC in the Supabase dashboard.
comment on table public.access_requests is 'Private access requests. Review status does not grant calculator access; approval remains separate.';
