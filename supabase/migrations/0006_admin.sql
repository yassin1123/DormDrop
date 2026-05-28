-- ===========================================================================
-- DormDrop — admin panel support
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
