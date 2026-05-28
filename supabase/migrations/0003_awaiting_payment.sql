-- ===========================================================================
-- DormDrop — add the 'awaiting_payment' order status
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
