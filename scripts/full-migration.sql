-- ===========================================================================
-- DormDrop — FULL DATABASE SETUP (migrations 0001-0010, consolidated)
--
-- For a FRESH Supabase project: open the SQL Editor, paste this whole file and
-- Run. It creates every table, enum, RLS policy, trigger, RPC and the Realtime
-- publications, seeds the catalogue + the two collection-point hubs, and is
-- safe to re-run (guards use IF NOT EXISTS / DROP ... IF EXISTS).
--
-- Sections, top to bottom:
--   0001  core schema: profiles, items, orders, order_items, enums, RLS, seed
--   0002  onboarding flag
--   0003  'awaiting_payment' order status
--   0004  payouts + atomic claim_order RPC + delivery trigger
--   0005  notifications + presence + review/notify triggers (+ Realtime)
--   0006  admin/moderation flags, items soft-delete
--   0007  "report a problem" submissions
--   0008  delivery coordinates (lat/lng on orders)
--   0009  live runner_locations (+ Realtime)
--   0010  collection points (+ hub seed) + item stock + stock RPCs
--
-- After running, make yourself an admin:
--   update public.profiles set is_admin = true where email = 'you@soton.ac.uk';
-- ===========================================================================
-- DormDrop — all migrations combined. Paste into Supabase SQL Editor and Run.
set check_function_bodies = off;

-- ===================== 0001_initial_schema.sql =====================
-- ===========================================================================
-- DormDrop â€” initial schema
-- Peer-to-peer student delivery for the University of Southampton.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`). It is
-- idempotent enough to re-run on a fresh project; for an existing project,
-- review the DROP guards before applying.
-- ===========================================================================

-- Needed for gen_random_uuid().
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('requester', 'runner', 'both');
  end if;

  if not exists (select 1 from pg_type where typname = 'item_category') then
    create type public.item_category as enum (
      'snacks', 'drinks', 'essentials', 'stationery', 'personal_care', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'pending', 'accepted', 'picking_up', 'on_the_way', 'delivered', 'cancelled'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- profiles â€” extends auth.users with app-specific fields
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '',
  phone             text,
  role              public.user_role not null default 'requester',
  delivery_zone     text,
  avatar_url        text,
  is_verified       boolean not null default false,
  runner_rating     numeric(3, 2),
  total_deliveries  integer not null default 0,
  total_earnings    numeric(10, 2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint profiles_runner_rating_range
    check (runner_rating is null or (runner_rating >= 0 and runner_rating <= 5))
);

-- ---------------------------------------------------------------------------
-- items â€” the catalogue of orderable things
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price        numeric(10, 2) not null check (price >= 0),
  category     public.item_category not null default 'other',
  image_url    text,
  in_stock     boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                          uuid primary key default gen_random_uuid(),
  requester_id                uuid not null references public.profiles (id) on delete cascade,
  runner_id                   uuid references public.profiles (id) on delete set null,
  status                      public.order_status not null default 'pending',
  delivery_zone               text not null,
  delivery_address            text not null,
  delivery_notes              text,
  subtotal                    numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee                numeric(10, 2) not null check (delivery_fee >= 0),
  platform_fee                numeric(10, 2) not null check (platform_fee >= 0),
  total                       numeric(10, 2) not null check (total >= 0),
  estimated_delivery_minutes  integer check (estimated_delivery_minutes is null or estimated_delivery_minutes >= 0),
  accepted_at                 timestamptz,
  picked_up_at                timestamptz,
  delivered_at                timestamptz,
  cancelled_at                timestamptz,
  created_at                  timestamptz not null default now(),

  -- A runner cannot deliver to themselves.
  constraint orders_runner_not_requester
    check (runner_id is null or runner_id <> requester_id)
);

-- ---------------------------------------------------------------------------
-- order_items â€” line items per order, with a price snapshot
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  item_id        uuid not null references public.items (id) on delete restrict,
  quantity       integer not null check (quantity > 0),
  price_at_time  numeric(10, 2) not null check (price_at_time >= 0)
);

-- ---------------------------------------------------------------------------
-- reviews â€” bidirectional ratings tied to an order
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  reviewer_id  uuid not null references public.profiles (id) on delete cascade,
  reviewee_id  uuid not null references public.profiles (id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),

  -- One review per direction per order.
  constraint reviews_unique_per_order_reviewer unique (order_id, reviewer_id)
);

-- ===========================================================================
-- Indexes
-- ===========================================================================
create index if not exists idx_orders_status         on public.orders (status);
create index if not exists idx_orders_requester_id   on public.orders (requester_id);
create index if not exists idx_orders_runner_id       on public.orders (runner_id);
create index if not exists idx_orders_delivery_zone   on public.orders (delivery_zone);
-- Hot query for runners: open jobs in their zone, newest first.
create index if not exists idx_orders_open_pool
  on public.orders (status, delivery_zone, created_at desc)
  where runner_id is null;

create index if not exists idx_order_items_order_id   on public.order_items (order_id);
create index if not exists idx_order_items_item_id     on public.order_items (item_id);

create index if not exists idx_reviews_order_id        on public.reviews (order_id);
create index if not exists idx_reviews_reviewee_id     on public.reviews (reviewee_id);

create index if not exists idx_items_category          on public.items (category);

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Keep profiles.updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up. Runs as the
-- definer (postgres) so it can write to profiles regardless of RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, delivery_zone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'requester'),
    new.raw_user_meta_data ->> 'delivery_zone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles    enable row level security;
alter table public.items       enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews     enable row level security;

-- Helper: is the current user a runner (or both)?
create or replace function public.is_runner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('runner', 'both')
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles policies
-- Profiles are semi-public (names + runner ratings appear on order cards), so
-- any authenticated user may read them. You may only modify your own row.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- items policies
-- Catalogue is public read-only. Writes happen via the service role (admin).
-- ---------------------------------------------------------------------------
drop policy if exists "items_select_all" on public.items;
create policy "items_select_all"
  on public.items for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- orders policies
-- ---------------------------------------------------------------------------

-- Requester sees their own orders; assigned runner sees theirs; any runner can
-- see the open (unclaimed, pending) pool.
drop policy if exists "orders_select_involved" on public.orders;
create policy "orders_select_involved"
  on public.orders for select
  to authenticated
  using (
    requester_id = auth.uid()
    or runner_id = auth.uid()
    or (status = 'pending' and runner_id is null and public.is_runner())
  );

-- Requesters create orders for themselves.
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Requester can update their own order (e.g. cancel while pending).
drop policy if exists "orders_update_requester" on public.orders;
create policy "orders_update_requester"
  on public.orders for update
  to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

-- A runner can claim an open order (pending + unassigned) and must assign it to
-- themselves, and can update orders already assigned to them.
drop policy if exists "orders_update_runner" on public.orders;
create policy "orders_update_runner"
  on public.orders for update
  to authenticated
  using (
    runner_id = auth.uid()
    or (status = 'pending' and runner_id is null and public.is_runner())
  )
  with check (runner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- order_items policies
-- Visible to anyone who can see the parent order. Insertable by the order's
-- requester (when building the order).
-- ---------------------------------------------------------------------------
drop policy if exists "order_items_select_visible" on public.order_items;
create policy "order_items_select_visible"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.requester_id = auth.uid()
          or o.runner_id = auth.uid()
          or (o.status = 'pending' and o.runner_id is null and public.is_runner())
        )
    )
  );

drop policy if exists "order_items_insert_own_order" on public.order_items;
create policy "order_items_insert_own_order"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.requester_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- reviews policies
-- Ratings are public read. You may only write a review as yourself, for an
-- order you took part in, and only once it's delivered.
-- ---------------------------------------------------------------------------
drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
  on public.reviews for select
  to authenticated
  using (true);

drop policy if exists "reviews_insert_participant" on public.reviews;
create policy "reviews_insert_participant"
  on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.status = 'delivered'
        and (o.requester_id = auth.uid() or o.runner_id = auth.uid())
        and reviews.reviewee_id in (o.requester_id, o.runner_id)
        and reviews.reviewee_id <> auth.uid()
    )
  );

-- ===========================================================================
-- Realtime â€” let clients subscribe to live order changes
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Wrapped in exception handling: re-running is harmless.
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.order_items;
    exception when duplicate_object then null;
    end;
  end if;
end$$;

-- ===========================================================================
-- Seed catalogue (optional â€” handy for local dev). Safe to delete.
-- ===========================================================================
insert into public.items (name, description, price, category) values
  ('Meal Deal',                  'Sandwich, snack & drink',            3.50, 'snacks'),
  ('Energy Drink',               '500ml can',                          1.80, 'drinks'),
  ('Bottled Water',              '750ml still',                        0.90, 'drinks'),
  ('Instant Noodles',            'Pot, chicken flavour',               1.20, 'essentials'),
  ('Paracetamol',                '16-pack',                            1.50, 'personal_care'),
  ('A4 Notebook',                '80 sheets, ruled',                   2.20, 'stationery'),
  ('Phone Charger Cable',        'USB-C, 1m',                          5.00, 'other'),
  ('Toilet Roll',               '4-pack',                             2.40, 'essentials'),
  ('Chocolate Bar',              'Milk, 45g',                          0.95, 'snacks'),
  ('Hand Sanitiser',             '50ml',                               1.30, 'personal_care')
on conflict do nothing;


-- ===================== 0002_onboarding.sql =====================
-- ===========================================================================
-- DormDrop â€” onboarding flag
--
-- Signup now only collects email + password; the rest of the profile (name,
-- phone, role, delivery zone) is captured on a dedicated /onboarding screen.
-- This column lets the app + middleware tell whether a user still needs to
-- finish that step.
-- ===========================================================================

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill: anyone who already has a name is treated as onboarded so existing
-- users aren't forced back through the flow.
update public.profiles
  set onboarding_completed = true
  where coalesce(full_name, '') <> '';


-- ===================== 0003_awaiting_payment.sql =====================
-- ===========================================================================
-- DormDrop â€” add the 'awaiting_payment' order status
--
-- Orders are created in 'awaiting_payment' and only promoted to 'pending'
-- (i.e. visible to runners) by the Stripe webhook once payment is confirmed.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in
-- some setups, so this lives in its own migration as a single statement. Run it
-- before 0004 (which does not reference the new value in DDL, so ordering is
-- only a convention here).
-- ===========================================================================

alter type public.order_status add value if not exists 'awaiting_payment';


-- ===================== 0004_payouts_and_claim.sql =====================
-- ===========================================================================
-- DormDrop â€” payouts, atomic claim, and delivery side-effects
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
-- trigger (SECURITY DEFINER) or the service-role key â€” never the client.
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
-- matches once the row is locked â€” the second gets NOT FOUND and errors.
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


-- ===================== 0005_reviews_notifications.sql =====================
-- ===========================================================================
-- DormDrop â€” trust & engagement: reviews recompute, notifications, presence
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles: account lifecycle + runner presence
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_active boolean not null default true;
alter table public.profiles
  add column if not exists is_online boolean not null default false;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'order_accepted',
      'order_picked_up',
      'order_delivered',
      'order_cancelled',
      'new_review',
      'new_order_nearby'
    );
  end if;
end$$;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  message     text not null,
  order_id    uuid references public.orders (id) on delete set null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications (user_id)
  where is_read = false;

alter table public.notifications enable row level security;

-- Users read + mark their own notifications. Inserts happen only via the
-- SECURITY DEFINER triggers below (or the service-role key).
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime so the bell updates live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- On new review: recompute the reviewee's average rating + notify them.
-- (Replaces the app-side recompute in /api/reviews.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
begin
  select round(avg(rating)::numeric, 2)
    into v_avg
    from public.reviews
   where reviewee_id = new.reviewee_id;

  update public.profiles
     set runner_rating = v_avg
   where id = new.reviewee_id;

  insert into public.notifications (user_id, type, title, message, order_id)
  values (
    new.reviewee_id,
    'new_review',
    'New review',
    'You received a ' || new.rating || 'â˜… review.',
    new.order_id
  );

  return new;
end;
$$;

drop trigger if exists trg_new_review on public.reviews;
create trigger trg_new_review
  after insert on public.reviews
  for each row execute function public.handle_new_review();

-- ---------------------------------------------------------------------------
-- On order status change: create the relevant notifications.
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    -- Order just went live (payment confirmed) â†’ tell runners in the zone.
    if new.status = 'pending' and old.status = 'awaiting_payment' then
      insert into public.notifications (user_id, type, title, message, order_id)
      select
        p.id,
        'new_order_nearby',
        'New order nearby',
        'A new order in ' || new.delivery_zone || ' Â· earn Â£' || new.delivery_fee::text,
        new.id
      from public.profiles p
      where p.role in ('runner', 'both')
        and p.delivery_zone = new.delivery_zone
        and p.id <> new.requester_id
        and p.is_active;

    elsif new.status = 'accepted' then
      insert into public.notifications (user_id, type, title, message, order_id)
      values (new.requester_id, 'order_accepted', 'Runner on the way',
        'A runner accepted your order and is heading to the shop.', new.id);

    elsif new.status = 'picking_up' then
      insert into public.notifications (user_id, type, title, message, order_id)
      values (new.requester_id, 'order_picked_up', 'Picking up your items',
        'Your runner is collecting your order now.', new.id);

    elsif new.status = 'delivered' then
      insert into public.notifications (user_id, type, title, message, order_id)
      values (new.requester_id, 'order_delivered', 'Delivered! ðŸŽ‰',
        'Your order arrived. Tap to rate your runner.', new.id);

    elsif new.status = 'cancelled' then
      -- The requester cancels, so notify the assigned runner (if any).
      if new.runner_id is not null then
        insert into public.notifications (user_id, type, title, message, order_id)
        values (new.runner_id, 'order_cancelled', 'Order cancelled',
          'An order you accepted was cancelled by the requester.', new.id);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_notifications on public.orders;
create trigger trg_order_notifications
  after update on public.orders
  for each row execute function public.handle_order_notifications();


-- ===================== 0006_admin.sql =====================
-- ===========================================================================
-- DormDrop â€” admin panel support
--
-- Admin reads/writes go through the service-role client AFTER verifying
-- is_admin server-side, so no broad RLS changes are needed here.
-- ===========================================================================

-- Profile flags for admin + moderation.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;
alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

-- Store the email on the profile so admins can search/display it without
-- touching auth.users.
alter table public.profiles
  add column if not exists email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is null;

-- Keep email in sync on signup (extends the 0001 handler).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, delivery_zone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'requester'),
    new.raw_user_meta_data ->> 'delivery_zone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Soft delete for catalogue items.
alter table public.items
  add column if not exists is_deleted boolean not null default false;

-- Helpful indexes for admin queries.
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_items_is_deleted on public.items (is_deleted);

-- ---------------------------------------------------------------------------
-- Make yourself an admin: replace the email and run this once.
--
--   update public.profiles
--      set is_admin = true
--    where id = (select id from auth.users where email = 'you@soton.ac.uk');
-- ---------------------------------------------------------------------------


-- ===================== 0007_reports.sql =====================
-- ===========================================================================
-- DormDrop â€” "Report a problem" submissions
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



-- ===========================================================================
-- 0008 — delivery coordinates (lat/lng of the geocoded delivery address)
-- ===========================================================================

alter table public.orders
  add column if not exists delivery_lat numeric(9, 6),
  add column if not exists delivery_lng numeric(9, 6);
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
-- ===========================================================================
-- DormDrop — collection points + basic stock tracking
--
--  * collection_points: the hubs runners pick orders up from.
--  * orders.collection_point_id: which hub an order is assigned to.
--  * items.stock_quantity: optional finite stock (null = unlimited).
--  * decrement_stock / increment_stock: race-safe stock adjustments, called
--    server-side only (service role) when an order is paid / cancelled.
-- ===========================================================================

-- --- Collection points -----------------------------------------------------
create table if not exists public.collection_points (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text not null,
  lat           numeric(9, 6) not null,
  lng           numeric(9, 6) not null,
  opening_hours text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.collection_points enable row level security;

-- Anyone signed in can read; admins (service role bypasses RLS) can write.
drop policy if exists "collection_points_select" on public.collection_points;
create policy "collection_points_select"
  on public.collection_points for select
  to authenticated
  using (true);

drop policy if exists "collection_points_admin_write" on public.collection_points;
create policy "collection_points_admin_write"
  on public.collection_points for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Seed the two launch hubs (idempotent).
insert into public.collection_points (name, address, lat, lng, opening_hours)
select 'DormDrop Hub — SUSU', 'Highfield Campus, University Road', 50.9354, -1.3964, '24/7'
where not exists (
  select 1 from public.collection_points where name = 'DormDrop Hub — SUSU'
);

insert into public.collection_points (name, address, lat, lng, opening_hours)
select 'DormDrop Hub — Portswood', 'Portswood Road', 50.9280, -1.3870, '08:00-23:00'
where not exists (
  select 1 from public.collection_points where name = 'DormDrop Hub — Portswood'
);

-- --- Order → collection point ----------------------------------------------
alter table public.orders
  add column if not exists collection_point_id uuid references public.collection_points (id);

-- --- Item stock ------------------------------------------------------------
alter table public.items
  add column if not exists stock_quantity integer;

-- --- Stock adjustment RPCs (service-role only) -----------------------------
-- Race-safe: each is a single UPDATE. SECURITY DEFINER so they can touch the
-- catalogue regardless of the caller, but execute is revoked from end users.
create or replace function public.decrement_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
     set stock_quantity = greatest(0, i.stock_quantity - oi.qty),
         in_stock = case
                      when greatest(0, i.stock_quantity - oi.qty) <= 0 then false
                      else i.in_stock
                    end
    from (
      select item_id, sum(quantity)::int as qty
        from public.order_items
       where order_id = p_order_id
       group by item_id
    ) oi
   where i.id = oi.item_id
     and i.stock_quantity is not null;
$$;

create or replace function public.increment_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
     set stock_quantity = i.stock_quantity + oi.qty,
         in_stock = true
    from (
      select item_id, sum(quantity)::int as qty
        from public.order_items
       where order_id = p_order_id
       group by item_id
    ) oi
   where i.id = oi.item_id
     and i.stock_quantity is not null;
$$;

revoke execute on function public.decrement_stock(uuid) from public;
revoke execute on function public.increment_stock(uuid) from public;
grant execute on function public.decrement_stock(uuid) to service_role;
grant execute on function public.increment_stock(uuid) to service_role;
