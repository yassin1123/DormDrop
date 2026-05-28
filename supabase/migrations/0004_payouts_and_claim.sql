-- ===========================================================================
-- DormDrop — payouts, atomic claim, and delivery side-effects
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- payout_status enum + payouts table
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending', 'paid');
  end if;
end$$;

create table if not exists public.payouts (
  id          uuid primary key default gen_random_uuid(),
  runner_id   uuid not null references public.profiles (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      numeric(10, 2) not null check (amount >= 0),
  status      public.payout_status not null default 'pending',
  created_at  timestamptz not null default now(),

  -- One payout per delivered order.
  constraint payouts_unique_order unique (order_id)
);

create index if not exists idx_payouts_runner_id on public.payouts (runner_id);
create index if not exists idx_payouts_status on public.payouts (status);

-- ---------------------------------------------------------------------------
-- RLS: runners read their own payouts. Writes happen only via the delivery
-- trigger (SECURITY DEFINER) or the service-role key — never the client.
-- ---------------------------------------------------------------------------
alter table public.payouts enable row level security;

drop policy if exists "payouts_select_own" on public.payouts;
create policy "payouts_select_own"
  on public.payouts for select
  to authenticated
  using (runner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- claim_order(): atomic, race-safe claim of an open order.
--
-- A single conditional UPDATE ... RETURNING is the lock: two concurrent calls
-- both target `status = 'pending' AND runner_id IS NULL`, but only the first
-- matches once the row is locked — the second gets NOT FOUND and errors.
-- ---------------------------------------------------------------------------
create or replace function public.claim_order(
  p_order_id uuid,
  p_runner_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  -- Only the runner themselves may claim, and only if they're actually a runner.
  if auth.uid() is null or auth.uid() <> p_runner_id then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not public.is_runner() then
    raise exception 'Not authorized: not a runner' using errcode = '42501';
  end if;

  update public.orders
     set runner_id = p_runner_id,
         status = 'accepted',
         accepted_at = now()
   where id = p_order_id
     and status = 'pending'
     and runner_id is null
  returning * into v_order;

  if not found then
    raise exception 'Order already claimed' using errcode = 'P0001';
  end if;

  return v_order;
end;
$$;

grant execute on function public.claim_order(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- On delivery: create the runner's payout + credit their profile stats.
-- Atomic with the status change, and idempotent (guarded by the status
-- transition + the unique payout per order).
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from 'delivered'
     and new.runner_id is not null then

    insert into public.payouts (runner_id, order_id, amount, status)
    values (new.runner_id, new.id, new.delivery_fee, 'pending')
    on conflict (order_id) do nothing;

    update public.profiles
       set total_deliveries = total_deliveries + 1,
           total_earnings = total_earnings + new.delivery_fee
     where id = new.runner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_delivered on public.orders;
create trigger trg_order_delivered
  after update on public.orders
  for each row execute function public.handle_order_delivered();
