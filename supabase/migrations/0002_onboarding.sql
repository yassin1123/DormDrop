-- ===========================================================================
-- DormDrop — onboarding flag
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
