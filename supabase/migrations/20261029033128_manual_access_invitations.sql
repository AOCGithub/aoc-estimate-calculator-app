-- Additive local trial. Existing request details and review decisions are preserved.
alter table public.access_requests drop constraint access_requests_review_status_check;
alter table public.access_requests add constraint access_requests_review_status_check
  check (review_status in ('pending', 'reviewed', 'approved', 'declined', 'revoked'));
grant select on public.access_requests to service_role;

create table public.access_invitations (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid not null references public.access_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  session_hash text unique check (session_hash is null or session_hash ~ '^[0-9a-f]{64}$'),
  session_expires_at timestamptz
);
create index access_invitations_request_id_idx on public.access_invitations(request_id);
alter table public.access_invitations enable row level security;
revoke all on public.access_invitations from public, anon, authenticated, service_role;
grant select on public.access_invitations to service_role;
grant update (used_at, session_hash, session_expires_at) on public.access_invitations to service_role;

-- One statement makes redemption single-use even when two visitors click together.
-- Invoker permissions only; the function is never callable by browser roles.
create function public.redeem_access_invitation(p_token_hash text, p_session_hash text, p_hours integer)
returns table (request_id uuid)
language sql volatile security invoker set search_path = ''
as $$
  update public.access_invitations as invitation
  set used_at = now(), session_hash = p_session_hash,
      session_expires_at = now() + make_interval(hours => p_hours)
  where invitation.token_hash = p_token_hash
    and invitation.used_at is null and invitation.expires_at > now()
    and p_hours between 1 and 24
    and exists (select 1 from public.access_requests as request
                where request.id = invitation.request_id and request.review_status = 'approved')
  returning invitation.request_id;
$$;
revoke all on function public.redeem_access_invitation(text, text, integer) from public, anon, authenticated;
grant execute on function public.redeem_access_invitation(text, text, integer) to service_role;
comment on table public.access_invitations is 'Private single-use invitation and session hashes. No raw access links are stored.';
