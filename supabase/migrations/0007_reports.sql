-- ===========================================================================
-- DormDrop — "Report a problem" submissions
--
-- Written only by the /api/report route (service role); read by admins via the
-- service role. RLS is enabled with no public policies, so nothing is exposed
-- to regular clients.
-- ===========================================================================

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  email       text not null,
  subject     text not null,
  message     text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reports_created_at on public.reports (created_at desc);

alter table public.reports enable row level security;
-- (No policies: service-role only.)
