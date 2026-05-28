-- ===========================================================================
-- DormDrop — trust & engagement: reviews recompute, notifications, presence
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
    'You received a ' || new.rating || '★ review.',
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
    -- Order just went live (payment confirmed) → tell runners in the zone.
    if new.status = 'pending' and old.status = 'awaiting_payment' then
      insert into public.notifications (user_id, type, title, message, order_id)
      select
        p.id,
        'new_order_nearby',
        'New order nearby',
        'A new order in ' || new.delivery_zone || ' · earn £' || new.delivery_fee::text,
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
      values (new.requester_id, 'order_delivered', 'Delivered! 🎉',
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
