-- ===========================================================================
-- DormDrop — initial schema
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
-- profiles — extends auth.users with app-specific fields
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
-- items — the catalogue of orderable things
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
-- order_items — line items per order, with a price snapshot
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  item_id        uuid not null references public.items (id) on delete restrict,
  quantity       integer not null check (quantity > 0),
  price_at_time  numeric(10, 2) not null check (price_at_time >= 0)
);

-- ---------------------------------------------------------------------------
-- reviews — bidirectional ratings tied to an order
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
-- Realtime — let clients subscribe to live order changes
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
-- Seed catalogue (optional — handy for local dev). Safe to delete.
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
