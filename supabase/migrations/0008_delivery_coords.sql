-- ===========================================================================
-- DormDrop — delivery coordinates
--
-- Stores the geocoded lat/lng of a delivery address (chosen via Google Places
-- autocomplete at checkout). Nullable: older orders and manually-typed
-- addresses simply leave them empty. Used to place the drop-off on a map and to
-- auto-detect the nearest delivery zone.
-- ===========================================================================

alter table public.orders
  add column if not exists delivery_lat numeric(9, 6),
  add column if not exists delivery_lng numeric(9, 6);
