-- ===========================================================================
-- DormDrop — live runner locations
--
-- One row per runner, upserted every ~10s while they have an active delivery
-- and deleted when they finish. Requesters subscribe (via Realtime) to their
-- runner's row to show a live tracking map.
-- ===========================================================================

create table if not exists public.runner_locations (
  id         uuid primary key default gen_random_uuid(),
  runner_id  uuid not null unique references public.profiles (id) on delete cascade,
  lat        numeric(9, 6) not null,
  lng        numeric(9, 6) not null,
  heading    numeric(5, 2),
  updated_at timestamptz not null default now()
);

alter table public.runner_locations enable row level security;

-- Any signed-in user can read (a requester tracks their assigned runner).
drop policy if exists "runner_locations_select" on public.runner_locations;
create policy "runner_locations_select"
  on public.runner_locations for select
  to authenticated
  using (true);

-- A runner manages only their own row.
drop policy if exists "runner_locations_insert_own" on public.runner_locations;
create policy "runner_locations_insert_own"
  on public.runner_locations for insert
  to authenticated
  with check (runner_id = auth.uid());

drop policy if exists "runner_locations_update_own" on public.runner_locations;
create policy "runner_locations_update_own"
  on public.runner_locations for update
  to authenticated
  using (runner_id = auth.uid())
  with check (runner_id = auth.uid());

drop policy if exists "runner_locations_delete_own" on public.runner_locations;
create policy "runner_locations_delete_own"
  on public.runner_locations for delete
  to authenticated
  using (runner_id = auth.uid());

-- Realtime so the requester's map updates live as the runner moves.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.runner_locations;
    exception when duplicate_object then null;
    end;
  end if;
end$$;
