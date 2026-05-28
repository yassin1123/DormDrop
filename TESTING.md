# DormDrop — End-to-End Test Checklist

Print this and check off each item. Test on a **real phone** (iPhone + Android)
as well as desktop — the mobile experience is the product.

---

## 0. Setup / prerequisites

- [ ] `.env.local` filled in (all 7 vars — see `.env.example`)
- [ ] Migrations `0001`–`0006` applied in order (`0003` run on its own)
- [ ] Catalogue seeded (`scripts/seed.mjs` or `supabase/seed.sql`)
- [ ] **Stripe CLI forwarding events** (orders only leave `awaiting_payment`
      when the webhook fires):
      `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] At least one account set as admin (`update profiles set is_admin = true …`)
- [ ] `npm run build` passes with no errors
- [ ] Test card ready: `4242 4242 4242 4242`, any future expiry, any CVC

---

## 1. Requester journey

- [ ] Sign up with email + password (`/signup`)
- [ ] Email confirmation handled (if enabled, link → `/auth/callback` → onboarding)
- [ ] Complete onboarding: full name, phone, **role cards** (Order), zone
- [ ] Land on requester dashboard (`/requester`) with greeting + zone
- [ ] Browse items; category chips filter the grid
- [ ] Search box filters items instantly as you type
- [ ] Add item → card shows quantity stepper; +/- adjusts (number pops)
- [ ] Floating cart bar appears, pulses on add, shows "View Cart · N · £X"
- [ ] Cart persists after a **page refresh** (localStorage)
- [ ] Tap cart → checkout **Step 1 Review**: edit qty / remove inline, fees + total
- [ ] **Step 2 Delivery**: zone pre-filled, address required, notes optional
- [ ] **Step 3 Payment**: sticky "Place Order" with lock icon; recap correct
- [ ] Redirects to Stripe; pay with test card
- [ ] Returns to confirmation: order number, ETA, status tracker, "Track Order"
- [ ] Basket is now empty
- [ ] Confirmation flips "Processing payment" → "Pending" live (webhook)
- [ ] Order appears in My Orders (`/requester/orders`)
- [ ] **Real-time**: status → Accepted updates without refresh when runner accepts
- [ ] **Real-time**: status → Picking Up updates live
- [ ] **Real-time**: status → Delivered updates live
- [ ] Notification bell shows accepted / delivered notifications (live count)
- [ ] "Rate Your Runner" button appears after delivery
- [ ] Star rating (tappable, animated) + comment submits; "Thanks for rating"
- [ ] Next-visit rate prompt appears if a delivered order is unrated, then stops
- [ ] Reorder from order history → items in cart → checkout
- [ ] Edit profile (name / phone / zone) and see it saved
- [ ] Order history filters by status + date range; "Load more" paginates
- [ ] Sign out, then sign back in → lands on requester dashboard

---

## 2. Runner journey

- [ ] Sign up as runner (role = Deliver) in onboarding
- [ ] Land on runner hub (`/runner`) with zone + OFFLINE state, empty feed
- [ ] Toggle **ONLINE** (power switch turns green); feed becomes live
- [ ] "No orders" empty state shows when feed is empty
- [ ] **Real-time**: a new paid order appears in the feed without refresh
- [ ] Feed card shows zone, masked address, items preview, big green "Earn £X"
- [ ] "My area" vs "All zones" scope toggle filters the feed
- [ ] Pull-to-refresh works on mobile
- [ ] Tap Accept → confirmation modal shows full items + address + earnings
- [ ] Confirm → order assigned to **you**, redirected to active delivery
- [ ] **Step 1**: item list shown; "I've picked up the items" → status picking_up
- [ ] **Step 2**: full address + notes shown; "I've delivered" → delivered
- [ ] **Step 3**: confetti + earnings amount shown; "Back to Dashboard"
- [ ] Today's earnings + total earned + deliveries increment on dashboard
- [ ] Pending payout amount reflects the delivery
- [ ] Delivery history (`/runner/history`) lists it with earnings + (later) rating
- [ ] Notification + rating: after requester rates, "new review" notification;
      review appears on the runner's profile

---

## 3. Admin journey

- [ ] Non-admin hitting `/admin` is redirected away
- [ ] Admin logs in, opens `/admin` → dashboard with 4 metrics + 4 charts
- [ ] Metrics look right (orders today, revenue today, active runners, avg time)
- [ ] Charts render (orders 7d, revenue 7d, busiest hours, popular items)
- [ ] Orders (`/admin/orders`): filter by status / zone / date, search address
- [ ] Manage modal shows full detail; change status; "Cancel & refund"
- [ ] Users (`/admin/users`): search by name/email; order counts + ratings
- [ ] Open a user → profile + order history; suspend / unsuspend
- [ ] Items (`/admin/items`): add item (form), edit (modal), toggle in stock
- [ ] Soft-delete an item → disappears from admin list **and** the catalogue
- [ ] Analytics (`/admin/analytics`): zones, runner leaderboard, requester
      stats, completion rate
- [ ] Admin sidebar on desktop / top nav on mobile; no bottom tab bar

---

## 4. Edge cases

- [ ] **Race**: two runners accept the same order → only one wins, the other
      sees "Someone just grabbed this one"; order leaves the loser's feed
- [ ] Requester cancels while runner is accepted → runner gets a cancellation
      notification; runner's active-delivery view shows "cancelled"
- [ ] Runner cancels mid-delivery → order returns to **pending** in the pool,
      `runner_id` cleared, reappears in feeds
- [ ] No runners online in zone → order stays pending; requester sees
      "Runners may be busy…" reassurance
- [ ] **Empty cart** checkout is blocked (empty-basket screen, no order created)
- [ ] **Stripe cancel/expire**: cancelling on Stripe returns to checkout with
      "Payment was cancelled", basket intact, the pending order is cancelled
- [ ] Abandon on Stripe page (close tab) → order stays `awaiting_payment`, never
      reaches runners (expected)
- [ ] **'both' role**: switch Order ↔ Deliver via navbar switcher; bottom-nav
      tabs adapt to the section
- [ ] **Refresh during any step** (browse, checkout, delivery, tracking) keeps
      state / reloads cleanly — no blank page
- [ ] **Network drop**: kill wifi briefly during order tracking → on reconnect
      the status re-syncs (realtime resubscribe + focus refetch)
- [ ] Suspended user is bounced to `/suspended` and can't checkout

---

## 5. Cross-cutting UX / polish

- [ ] Every data-fetching screen shows a loading skeleton/spinner (no blank flash)
- [ ] Every route has an error state with a retry (force an error to verify)
- [ ] Prices are **always** `£X.XX` (never `£2.1` or `£2.1000`)
- [ ] Timestamps show relative ("5 min ago") or tidy local date/time
- [ ] Optional fields never crash: unassigned runner, no rating, no notes
- [ ] **iOS**: focusing an input does **not** auto-zoom the page
- [ ] Bottom nav clears the iPhone home indicator (safe-area padding)
- [ ] Submit buttons disable after first click (no double orders / double reviews)
- [ ] Leading/trailing spaces in form fields are trimmed before saving
- [ ] Page transitions feel smooth (fade/lift on navigation)
- [ ] Tappable elements give press feedback (scale) and are ≥ 40px on mobile

---

## 6. Sign-off

| Area | Tester | Date | Pass? |
| --- | --- | --- | --- |
| Requester journey | | | |
| Runner journey | | | |
| Admin journey | | | |
| Edge cases | | | |
| Cross-cutting UX | | | |
