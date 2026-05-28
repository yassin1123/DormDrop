# 💧 DormDrop

**Peer-to-peer student delivery for the University of Southampton.** Students
request snacks, drinks and essentials; fellow students ("Runners") deliver them;
the platform takes a small fee. Open 24/7, no minimum order.

> Anything delivered to your door. Any hour. — by Southampton students, for
> Southampton students.

---

## ✨ Features

**Requesters**
- Browse a real catalogue with category filters + instant search, "X left"
  low-stock badges, and a Deliveroo-style item detail sheet
- Persistent cart (survives refresh + the payment round-trip)
- 3-step checkout (review → delivery → payment) via Stripe Checkout, with
  **Google Places address autocomplete** (biased to Southampton)
- **Live delivery map** (Google Maps): the runner's position updates in
  real time with a **ticking ETA countdown** ("Arriving in ~X mins")
- **Distance-based delivery fee** + smart ETA, shown *before* you pay
- "Recent orders" with one-tap **reorder**; rate runners; edit profile

**Runners**
- A power-switch online/offline toggle (with presence)
- Live feed of nearby open orders (realtime + pull-to-refresh + sound/buzz)
- Race-safe order acceptance, step-by-step delivery flow, confetti + "cha-ching"
- **Pickup-hub assignment** + Google Maps "Navigate" links to the collection
  point and the door; **live location broadcasting** while delivering
- Weekly earnings chart, pending payouts, delivery history, reviews
- Share earnings as a generated card

**Admin** (`/admin`)
- Dashboard with key metrics + charts (Recharts)
- Order / user / item management (inline stock editing); analytics + leaderboards
- **Collection points** manager (map + add/edit/deactivate hubs)
- Suspend users, soft-delete items, override order status

**Delight & trust**
- **University-only signup** — `@soton.ac.uk` email required
- **Browser push notifications** (Web Notifications API) when a tab is
  backgrounded, plus live in-app notifications
- Live platform stats on the landing page (real delivered count + runners
  online, cached 60s) with a pinned delivery-zone map
- First-run 3-screen intro, contextual time-of-day messages, beautiful empty
  states, PWA install + offline page, `/help` + FAQ.

---

## 🧱 Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 14** (App Router, RSC) + **TypeScript** |
| Styling | **Tailwind CSS** (Plus Jakarta Sans, emerald + amber brand) |
| Backend | **Supabase** — Postgres, Auth, Row Level Security, Realtime |
| Payments | **Stripe** Checkout + webhooks |
| Maps | **Google Maps** JS SDK — maps, Places autocomplete, live tracking |
| Charts | **Recharts** (admin only — code-split off the user bundles) |
| Hosting | **Vercel** |

---

## 🚀 Local setup

**Prerequisites:** Node 18+, a [Supabase](https://supabase.com) project, a
[Stripe](https://stripe.com) account, and the [Stripe CLI](https://stripe.com/docs/stripe-cli).

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local      # then fill in the values (see below)

# 3. Set up the database (see "Database" section)

# 4. Run
npm run dev                      # http://localhost:3000

# 5. In a second terminal, forward Stripe webhooks (required for payments)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
#   → copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, restart dev
```

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Seed demo data (5 users, catalogue, orders, reviews) |

---

## 🔑 Environment variables

Copy `.env.example` → `.env.local`. `NEXT_PUBLIC_*` reach the browser; the rest
are **server-only secrets** — never prefix a secret with `NEXT_PUBLIC_`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Bypasses RLS (webhook, admin, presence) |
| `STRIPE_SECRET_KEY` | server | Stripe server SDK |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | server | Verifies webhook signatures |
| `NEXT_PUBLIC_APP_URL` | public | Base URL (Stripe redirects, OG tags) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | public | Maps, Places autocomplete, live tracking. Enable **Maps JavaScript + Places + Geocoding + Directions** APIs. Optional — without it, maps show a placeholder and the address field is a plain input. |
| `RESEND_API_KEY` *(optional)* | server | Email "Report a problem" submissions |
| `REPORT_EMAIL_TO` *(optional)* | server | Where report emails are sent |
| `SUPABASE_DB_URL` *(optional)* | server | Direct Postgres URI for `npm run migrate` |

---

## 🗄️ Database

**Easiest:** on a fresh Supabase project, paste **`scripts/full-migration.sql`**
(all of 0001–0010, consolidated + commented) into the SQL Editor and Run.

Or run each file in `supabase/migrations/` **in order** (Supabase SQL editor,
or `supabase db push`):

| File | Adds |
| --- | --- |
| `0001_initial_schema.sql` | tables, enums, RLS, signup trigger, indexes, demo seed |
| `0002_onboarding.sql` | `profiles.onboarding_completed` |
| `0003_awaiting_payment.sql` | `awaiting_payment` order status — **run on its own** |
| `0004_payouts_and_claim.sql` | `payouts`, atomic `claim_order` RPC, delivery trigger |
| `0005_reviews_notifications.sql` | notifications, presence, review/notify triggers |
| `0006_admin.sql` | `is_admin`/`is_suspended`/`email`, `items.is_deleted` |
| `0007_reports.sql` | "Report a problem" submissions |
| `0008_delivery_coords.sql` | `orders.delivery_lat` / `delivery_lng` |
| `0009_runner_locations.sql` | live `runner_locations` table (+ Realtime) |
| `0010_collection_points.sql` | `collection_points` (+ 2 seeded hubs), `orders.collection_point_id`, `items.stock_quantity`, stock RPCs |

> `0003` must run alone — `ALTER TYPE … ADD VALUE` can't share a transaction
> with statements that use the new value. (The consolidated
> `scripts/full-migration.sql` is ordered to avoid this.)

Then load the catalogue + demo data:

```bash
npm run seed     # uses SUPABASE_SERVICE_ROLE_KEY from .env.local
```

Make yourself an admin:

```sql
update public.profiles set is_admin = true where email = 'you@soton.ac.uk';
```

Security model: **RLS is on for every table** and scopes data to its owner
(requesters see their orders, runners see theirs + the open pool, etc.). The
admin panel and webhooks verify identity server-side, then use the service-role
client to bypass RLS deliberately.

---

## ☁️ Deployment

Full step-by-step (GitHub → Vercel → custom domain, Supabase production, Stripe
live mode, security checklist) lives in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

Testing checklist for every user journey + edge cases:
**[TESTING.md](TESTING.md)**.

The short version:

1. Push to GitHub, import into Vercel.
2. Set all env vars in Vercel (Production).
3. Run the migrations + seed against the production Supabase project.
4. Switch Stripe to live keys, add the live webhook
   (`https://<domain>/api/webhooks/stripe`), set `STRIPE_WEBHOOK_SECRET`.
5. Add your custom domain and update `NEXT_PUBLIC_APP_URL`.

---

## 📁 Project structure

```
app/
  page.tsx                         Landing (+ first-run intro)
  (auth)/                          login, signup, forgot/reset password
  onboarding/                      name, phone, role, zone
  (dashboard)/requester/           browse · checkout · orders · order detail
  (dashboard)/runner/              hub · active delivery · history
  (dashboard)/profile/             account, stats, reviews, edit
  admin/                           dashboard · orders · users · items · analytics
  help/                            FAQ + report a problem
  api/                             orders, checkout, reviews, report,
                                   webhooks/stripe, admin/*
  opengraph-image.tsx · icon.svg · manifest (public/)
components/  ui · layout · orders · runner · auth · cart · feedback ·
             notifications · reviews · share · onboarding · admin · help ·
             map (GoogleMap · DeliveryMap · AddressAutocomplete)
hooks/       useOrderSubscription · useAvailableOrders · useRunnerLocation ·
             useLocationBroadcast · useCollectionPoint · useWebNotifications
lib/         supabase · stripe · admin · constants · utils · stats ·
             google-maps-loader · rate-limit · sounds · share-card ·
             orders-server · order-select
public/      manifest.json · sw.js · offline.html
supabase/    migrations/ · seed.sql
middleware.ts                      session, onboarding, role + admin guards
```

---

## 📸 Screenshots

> _Coming soon — add screenshots/GIFs of the landing page, browse, checkout,
> runner hub, live tracking, and the admin dashboard here._

| Landing | Browse | Checkout |
| --- | --- | --- |
| _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

| Runner hub | Live tracking | Admin |
| --- | --- | --- |
| _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

---

## 🗺️ Roadmap

- ✅ ~~Live GPS tracking of the runner on a map~~ — **shipped** (Google Maps)
- ✅ ~~Push notifications (web push)~~ — **shipped** (Web Notifications API)
- 📱 **Native apps** (iOS/Android) via React Native / Expo + native push
- 💬 **In-app chat** between requester and runner
- 💳 **Stripe Connect** payouts — pay runners automatically
- 🤖 **AI-recommended items** based on time, weather and order history
- ⭐ Runner tiers / incentives, scheduled orders, group orders

---

## 📄 License

Private project — University of Southampton student initiative. Not for
redistribution without permission.

Built with 💧 for UoS students.
