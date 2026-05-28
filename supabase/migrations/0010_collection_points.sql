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
