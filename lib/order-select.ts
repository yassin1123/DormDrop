/**
 * The canonical Supabase `select` for an order with everything the UI needs:
 * its line items (joined to the catalogue item) and both profiles. The FK hints
 * disambiguate the two profile references on `orders`.
 *
 * Centralised so the server routes, server pages, and the client realtime
 * refetch never drift apart. Safe to import anywhere (it's just a string).
 */
export const ORDER_SELECT = `
  *,
  order_items ( *, item:items (*) ),
  requester:profiles!orders_requester_id_fkey ( id, full_name, avatar_url, delivery_zone ),
  runner:profiles!orders_runner_id_fkey ( id, full_name, avatar_url, runner_rating )
`;
