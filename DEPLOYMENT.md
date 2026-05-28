# DormDrop — Deployment Guide

Ship DormDrop to production: GitHub → Vercel → custom domain, with Supabase and
Stripe in live mode. Work top to bottom.

---

## 1. Vercel deployment

### 1.1 Initialise git & push to GitHub

```bash
# from the project root
git init
git add -A
git commit -m "DormDrop: initial production build"

# create an EMPTY repo on github.com (no README), then:
git branch -M main
git remote add origin https://github.com/<you>/dormdrop.git
git push -u origin main
```

> `.gitignore` already excludes `.env*.local`, `node_modules`, `.next`. **Never
> commit secrets** — only `.env.example` (no values) is tracked.

### 1.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Import your `dormdrop` GitHub repo.
3. Framework preset auto-detects **Next.js**. Leave build/output defaults
   (`next build`). No `vercel.json` is needed.
4. **Don't deploy yet** — add env vars first (next step).

### 1.3 Set environment variables in Vercel

Project → **Settings → Environment Variables**. Add all seven for the
**Production** environment (and Preview if you want PR previews to work):

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (⚠ secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (**live** later) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → API keys (**live** later) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks (set in §3) |
| `NEXT_PUBLIC_APP_URL` | `https://dormdrop.co.uk` (your final domain) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud Console (see §1.6) |

> Set `NEXT_PUBLIC_APP_URL` to the real domain you'll use. It drives Stripe
> redirect URLs and Open Graph `metadataBase`. Until the domain is live you can
> temporarily use the `*.vercel.app` URL, then update it.

> `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is **optional** — without it, maps render a
> placeholder and the checkout address becomes a plain text input (everything
> else still works: orders fall back to a flat £2 fee and the SUSU hub). Set it
> to get live tracking, address autocomplete and distance-based fees.

### 1.6 Google Maps API key

1. [Google Cloud Console](https://console.cloud.google.com) → create/select a
   project → **APIs & Services → Library** and **enable**: **Maps JavaScript
   API**, **Places API**, **Geocoding API**, **Directions API**.
2. **APIs & Services → Credentials → Create credentials → API key.**
3. Restrict it: **Application restrictions → HTTP referrers**, allow
   `https://dormdrop.co.uk/*`, `https://*.vercel.app/*` and
   `http://localhost:3000/*`. **API restrictions →** limit to the four APIs
   above.
4. Set it as `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in Vercel (Production) and in your
   local `.env.local`. It's a public (browser) key — referrer restrictions are
   what protect it, so set them.

### 1.4 Deploy

Click **Deploy**. You'll get `https://dormdrop-xxxx.vercel.app`. Every push to
`main` auto-deploys; PRs get preview URLs.

### 1.5 Custom domain (`dormdrop.co.uk`)

**Buy it:** any registrar sells `.co.uk` — e.g. [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
(at-cost), [Namecheap](https://www.namecheap.com), or [123-reg](https://www.123-reg.co.uk).
Search `dormdrop.co.uk`, add to basket, check out (~£8–12/yr).

**Connect it:**

1. Vercel → Project → **Settings → Domains → Add** → enter `dormdrop.co.uk`.
2. Add `www.dormdrop.co.uk` too and set one to redirect to the other (Vercel
   offers this).
3. Vercel shows the DNS records to create at your registrar:
   - **Apex** `dormdrop.co.uk` → `A` record → `76.76.21.21`
   - **www** → `CNAME` → `cname.vercel-dns.com`
   - (Or point the domain's **nameservers** at Vercel and skip manual records.)
4. Save at the registrar. DNS propagates in minutes–hours; Vercel issues the
   TLS cert automatically.
5. Update `NEXT_PUBLIC_APP_URL` to `https://dormdrop.co.uk` in Vercel and
   **redeploy** so Stripe/OG use the final URL.

---

## 2. Supabase production setup

Use a dedicated **production** Supabase project (don't reuse a throwaway dev
one). Get its URL + keys into Vercel (§1.3).

### 2.1 Run the migrations

**Fastest:** paste **`scripts/full-migration.sql`** (all of 0001–0010,
consolidated, ordered to avoid the `0003` enum-transaction issue) into the
Supabase **SQL Editor** and Run. It also seeds the catalogue and the two
collection-point hubs.

Or run each file from `supabase/migrations/` in order:

```
0001_initial_schema.sql        tables, enums, RLS, trigger, indexes, seed
0002_onboarding.sql            profiles.onboarding_completed
0003_awaiting_payment.sql      'awaiting_payment' status   (run on its own)
0004_payouts_and_claim.sql     payouts, claim_order RPC, delivery trigger
0005_reviews_notifications.sql notifications, presence, review/notify triggers
0006_admin.sql                 is_admin/is_suspended/email, items.is_deleted
0007_reports.sql               "report a problem" submissions
0008_delivery_coords.sql       orders.delivery_lat / delivery_lng
0009_runner_locations.sql      live runner_locations table (+ Realtime)
0010_collection_points.sql     collection_points (+2 seeded hubs),
                               orders.collection_point_id, items.stock_quantity,
                               decrement/increment_stock RPCs
```

> Run `0003` **by itself** — `ALTER TYPE … ADD VALUE` can't share a transaction
> with statements that use the new value. (The consolidated
> `scripts/full-migration.sql` handles ordering; or use `supabase db push`.)

> **Realtime:** `0005` and `0009` add their tables to the `supabase_realtime`
> publication. If live order updates or the runner tracking pin don't move,
> check **Database → Replication** and ensure `orders`, `order_items`,
> `notifications` and `runner_locations` are enabled.

> **Collection points** are seeded automatically by `0010` (SUSU + Portswood).
> Manage them at **/admin/collection-points** after go-live.

### 2.2 Verify RLS (table by table)

RLS is **on** for every table. Confirm in SQL Editor (`select * from …` as an
anon/other user should be blocked). Expected behaviour:

- [ ] **profiles** — any signed-in user can *read* profiles (names/ratings show
      on order cards); you can only *insert/update your own*. Admin writes use
      the service-role key.
- [ ] **items** — public *read* (catalogue); queries also filter
      `is_deleted = false`. Writes only via the admin (service-role) routes.
- [ ] **orders** — a requester sees only their orders; a runner sees orders
      assigned to them **plus** the open pool (`pending` + unclaimed, runners
      only). Insert only as yourself (requester). Updates: requester can cancel
      their own; runner can claim (atomic `claim_order` RPC) / advance theirs.
- [ ] **order_items** — readable only if you can see the parent order;
      insertable only by that order's requester.
- [ ] **reviews** — readable by signed-in users (public ratings); insertable
      only by a participant of a **delivered** order, once, not for yourself.
- [ ] **payouts** — a runner reads only their own; rows are written by the
      delivery trigger / service role only.
- [ ] **notifications** — you read + mark-read only your own; rows are inserted
      only by SECURITY DEFINER triggers / service role.
- [ ] **collection_points** — any signed-in user can *read*; writes are
      admin-only (the admin UI uses the service role).
- [ ] **runner_locations** — any signed-in user can *read* (a requester tracks
      their runner); a runner upserts/deletes only their own row. `decrement_`
      / `increment_stock` RPCs are `EXECUTE`-revoked from end users
      (service-role only).

> The admin panel never relies on RLS — it verifies `is_admin` server-side then
> uses the service-role client. So make sure `SUPABASE_SERVICE_ROLE_KEY` is set
> in Vercel and **never** exposed with a `NEXT_PUBLIC_` prefix.

### 2.3 Enable email confirmation

Supabase → **Authentication → Providers → Email** → turn **Confirm email** on.
With it on, signup shows the "check your inbox" screen; the link returns to
`/auth/callback?next=/onboarding`.

### 2.4 Auth redirect URLs (production)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://dormdrop.co.uk`
- **Redirect URLs (allow-list):** add
  - `https://dormdrop.co.uk/auth/callback`
  - `https://dormdrop.co.uk/**` (covers reset-password etc.)
  - keep `http://localhost:3000/**` for local dev

Without these, confirmation / password-reset links will be rejected.

### 2.5 Seed production (optional, for launch/demo)

```bash
# locally, with .env.local pointing at the PRODUCTION project:
npm run seed
```

Then make yourself admin:

```sql
update public.profiles set is_admin = true
 where email = 'you@soton.ac.uk';
```

> Skip the demo *orders/users* on a real launch if you only want the real
> catalogue — `supabase/seed.sql` seeds just the 31 items.

---

## 3. Stripe production (live mode)

### 3.1 Switch to live keys

1. Stripe Dashboard → toggle **Test mode → off** (top right).
2. **Developers → API keys** → copy the **live** publishable + secret keys.
3. In Vercel, set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   to the **live** values (Production env).

### 3.2 Live webhook endpoint

1. Stripe (live mode) → **Developers → Webhooks → Add endpoint**.
2. URL: `https://dormdrop.co.uk/api/webhooks/stripe`
3. Events to send:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Create it, then **reveal the Signing secret** (`whsec_…`) and set it as
   `STRIPE_WEBHOOK_SECRET` in Vercel (Production). **Redeploy.**

> The webhook is what moves an order from `awaiting_payment` → `pending`. If the
> secret is wrong, signatures fail (400) and orders never reach runners.

### 3.3 Test with a real £0.50 transaction

1. Temporarily add a cheap £0.50 item via **/admin/items** (e.g. "Test 50p").
2. Place a real order with a **real card**, complete payment.
3. Confirm: order flips to `pending` live, appears in the runner feed, and the
   Stripe **Payments** tab shows the £0.50 charge.
4. **Refund** it: Stripe → Payments → the charge → **Refund**.
5. Delete the test item (admin → soft delete).

---

## 4. Performance & PWA (already in the repo)

- **Images:** `next/image` is used for item images; `next.config.mjs` enables
  AVIF/WebP and allow-lists Supabase Storage. Add any new image hosts there.
- **Meta / Open Graph:** title + description + OG/Twitter tags are in
  `app/layout.tsx`; a branded share image is generated at
  `app/opengraph-image.tsx` (1200×630, auto-linked).
- **Favicon:** `app/icon.svg` (emerald droplet mark) is the favicon.
- **PWA:** `public/manifest.json` + `theme_color` make the app installable
  ("Add to Home Screen"). `public/sw.js` (registered by
  `ServiceWorkerRegister`, production only) serves `public/offline.html` when a
  navigation fails — so the app shows **"You're offline"** instead of a crash.

**Recommended polish before launch (needs an image tool, e.g. realfavicongenerator.net):**

- [ ] Export PNG icons from `app/icon.svg`: `icon-192.png`, `icon-512.png`,
      and `apple-icon.png` (180×180) into `/public`, then add them to
      `manifest.json` `icons[]` and drop `app/apple-icon.png`. iOS uses a PNG
      apple-touch-icon for the home-screen tile (it ignores SVG).
- [ ] Run **Lighthouse** (Chrome DevTools) on the deployed URL; aim for
      Performance + PWA ≥ 90.

---

## 5. Security checklist

- [x] **Auth on every mutating API route** — `orders`, `orders/[id]`,
      `checkout`, `reviews`, `reviews/pending`, and all `admin/*` routes call
      `getUser()` (and admin routes `requireAdmin`) before doing anything. The
      only unauthenticated route is the public `GET /api/items` catalogue.
- [x] **RLS isolates user data** — see §2.2; users can't read others' orders,
      payouts or notifications.
- [x] **Stripe webhook signature verified** — `constructEvent` with
      `STRIPE_WEBHOOK_SECRET`; bad signatures get 400, handlers are idempotent.
- [x] **No secrets on the client** — only `NEXT_PUBLIC_*` reach the browser;
      `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
      are server-only and used only in route handlers / the admin layer.
- [x] **Rate limiting** — `lib/rate-limit.ts` applies per-user fixed windows to
      `checkout` (10/min), `orders` create (10/min), `orders/[id]` mutations
      (40/min) and `reviews` (15/min); over-limit → `429`.
- [x] **Input handling** — inputs are trimmed + validated server-side; prices
      are recomputed from the DB (never trusted from the client); the admin user
      search is sanitised against PostgREST filter injection; Supabase
      parameterises queries (no SQL injection); React escapes output (no XSS).
- [x] **Security headers** — `next.config.mjs` sets `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and
      drops the `X-Powered-By` header.

### Known limitations / next hardening steps

- **Rate limiting is per-instance (in-memory).** It deters bursts but isn't
  shared across Vercel's serverless instances. For hard limits, back it with
  **Upstash Redis** (`@upstash/ratelimit`) keyed by user/IP.
- **"Cancel & refund" (admin) only changes status** — it doesn't call Stripe's
  refund API yet. Wire `stripe.refunds.create({ payment_intent })` once you
  persist the PaymentIntent id on the order.
- **No Content-Security-Policy yet.** A strict CSP is worthwhile but needs
  careful allow-listing for Next inline scripts + Supabase + Stripe; add it once
  the surface is stable.
- **Suspended users** are blocked from the app + checkout via middleware, but
  can still authenticate with Supabase. For a hard block, add an auth hook.

---

## 6. Go-live smoke test (on the production domain)

- [ ] Sign up with a **non-`@soton.ac.uk`** email → rejected; `@soton.ac.uk` →
      confirmation → onboarding → dashboard
- [ ] Checkout address autocomplete suggests Southampton addresses; the
      delivery fee shows the distance + recalculates the total
- [ ] Place an order with a **live** card → webhook flips it to `pending`
- [ ] Runner (second account) sees it, accepts; the order shows its **pickup
      hub** + Navigate links → delivers → requester sees it live
- [ ] Live map shows the runner moving + a ticking "Arriving in ~X mins"
- [ ] Background the requester tab → a **browser notification** fires on update
- [ ] Rate the runner → runner's rating + review update
- [ ] Admin dashboard loads with real metrics; **/admin/collection-points**
      lists the two hubs; landing page shows the real delivered count
- [ ] "Add to Home Screen" works on a phone; offline shows the offline page
- [ ] Lighthouse Performance/PWA ≥ 90
