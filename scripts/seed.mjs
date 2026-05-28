/**
 * DormDrop demo seed.
 *
 * Populates a Supabase project with realistic demo data so the app doesn't look
 * empty: 5 users (3 requesters, 2 runners), the full catalogue, 10 orders
 * across every status, and 5 reviews.
 *
 * Run from the project root:
 *   node scripts/seed.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
 * .env.local or the environment). Uses the service role, so it bypasses RLS.
 * Safe to re-run: users/items are upserted; orders/reviews are only seeded once.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function loadEnv() {
  const out = { ...process.env };
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!out[m[1]]) out[m[1]] = val;
    }
  } catch {
    // no .env.local — rely on process.env
  }
  return out;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "  Add them to .env.local (or your environment) and re-run.",
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function fees(subtotal) {
  const delivery_fee = 2.0;
  const platform_fee = round2(subtotal * 0.1);
  return {
    subtotal: round2(subtotal),
    delivery_fee,
    platform_fee,
    total: round2(subtotal + delivery_fee + platform_fee),
  };
}

/** ISO timestamp `daysAgo` days back, anchored at 13:00, plus `addMin` minutes. */
function ts(daysAgo, addMin = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(13, 0, 0, 0);
  d.setMinutes(d.getMinutes() + addMin);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const USERS = [
  { key: "alice", email: "alice@soton.ac.uk", full_name: "Alice Chen", phone: "07700900001", role: "requester", zone: "Glen Eyre" },
  { key: "ben", email: "ben@soton.ac.uk", full_name: "Ben Okafor", phone: "07700900002", role: "requester", zone: "Portswood" },
  { key: "chloe", email: "chloe@soton.ac.uk", full_name: "Chloe Ahmed", phone: "07700900003", role: "requester", zone: "Mayflower" },
  { key: "dan", email: "dan@soton.ac.uk", full_name: "Dan Murphy", phone: "07700900004", role: "runner", zone: "Glen Eyre" },
  { key: "eve", email: "eve@soton.ac.uk", full_name: "Eve Larsson", phone: "07700900005", role: "both", zone: "Portswood" },
];
const PASSWORD = "password123";

const ITEMS = [
  ["Doritos (Cool Original)", "Cool Original tortilla chips, sharing bag", 1.75, "snacks"],
  ["Pringles (Original)", "Original flavour, 185g tube", 2.5, "snacks"],
  ["Cadbury Dairy Milk", "Milk chocolate bar, 110g", 1.75, "snacks"],
  ["Kit Kat Chunky", "Milk chocolate wafer bar", 0.85, "snacks"],
  ["Haribo Tangfastics", "Sour fruit gums, 160g bag", 1.5, "snacks"],
  ["McCoy's (Flame Grilled Steak)", "Ridge cut crisps, grab bag", 1.25, "snacks"],
  ["Walkers (Cheese & Onion)", "Classic crisps, grab bag", 1.1, "snacks"],
  ["Galaxy Caramel", "Smooth milk chocolate with caramel", 1.2, "snacks"],
  ["Percy Pigs", "Fruity gums, 170g bag", 1.75, "snacks"],
  ["Snickers", "Peanut & caramel chocolate bar", 0.95, "snacks"],
  ["Red Bull (250ml)", "Energy drink, 250ml can", 1.75, "drinks"],
  ["Monster Energy", "Energy drink, 500ml can", 1.85, "drinks"],
  ["Coca-Cola (500ml)", "Classic Coke, 500ml bottle", 1.85, "drinks"],
  ["Lucozade Original", "Energy drink, 380ml bottle", 1.5, "drinks"],
  ["Ribena", "Blackcurrant juice drink, 500ml", 1.4, "drinks"],
  ["Volvic Water (1L)", "Still natural mineral water, 1 litre", 1.2, "drinks"],
  ["Oasis Citrus Punch", "Citrus juice drink, 500ml bottle", 1.5, "drinks"],
  ["Tropicana Orange Juice", "Smooth orange juice, 300ml", 1.95, "drinks"],
  ["Paracetamol", "Pain relief, 16 tablets", 1.25, "essentials"],
  ["Toilet Roll (4-pack)", "Soft toilet tissue, 4 rolls", 2.5, "essentials"],
  ["Washing Up Liquid", "Original, 450ml", 1.5, "essentials"],
  ["Bin Bags", "Tie-handle bin liners, 20 pack", 2.0, "essentials"],
  ["Kitchen Roll", "Absorbent kitchen towel, 2 rolls", 2.25, "essentials"],
  ["Milk (1 pint)", "Fresh semi-skimmed milk, 568ml", 0.95, "essentials"],
  ["Black Biro Pens (pack of 5)", "Smooth ballpoint pens, black ink", 2.0, "stationery"],
  ["A4 Notebook", "Ruled, 80 sheets", 2.5, "stationery"],
  ["Highlighters (pack of 4)", "Assorted neon highlighters", 3.0, "stationery"],
  ["USB-C Cable", "Fast-charge USB-C cable, 1m", 6.5, "stationery"],
  ["Toothpaste", "Fluoride toothpaste, 75ml", 2.5, "personal_care"],
  ["Deodorant (Sure)", "Anti-perspirant spray, 150ml", 3.0, "personal_care"],
  ["Hand Sanitiser", "Antibacterial gel, 50ml", 1.75, "personal_care"],
];

// requester, runner (null = unclaimed), status, items [[name, qty]], daysAgo
const ORDERS = [
  { req: "alice", runner: null, status: "pending", daysAgo: 0, items: [["Red Bull (250ml)", 2], ["Doritos (Cool Original)", 1]] },
  { req: "chloe", runner: "dan", status: "accepted", daysAgo: 0, items: [["Cadbury Dairy Milk", 1], ["Coca-Cola (500ml)", 1]] },
  { req: "alice", runner: "dan", status: "picking_up", daysAgo: 0, items: [["Kit Kat Chunky", 2]] },
  { req: "ben", runner: "eve", status: "on_the_way", daysAgo: 0, items: [["Monster Energy", 1], ["Pringles (Original)", 1]] },
  { req: "ben", runner: null, status: "cancelled", daysAgo: 1, items: [["Paracetamol", 1], ["Volvic Water (1L)", 1]] },
  { req: "alice", runner: "dan", status: "delivered", daysAgo: 1, items: [["Toilet Roll (4-pack)", 1], ["Milk (1 pint)", 1]] },
  { req: "ben", runner: "eve", status: "delivered", daysAgo: 2, items: [["Snickers", 3]] },
  { req: "chloe", runner: "dan", status: "delivered", daysAgo: 3, items: [["Haribo Tangfastics", 1], ["Lucozade Original", 1]] },
  { req: "alice", runner: "eve", status: "delivered", daysAgo: 4, items: [["Toothpaste", 1], ["Deodorant (Sure)", 1]] },
  { req: "chloe", runner: "dan", status: "delivered", daysAgo: 5, items: [["A4 Notebook", 1], ["Black Biro Pens (pack of 5)", 1]] },
];

// One review per delivered order (index into ORDERS), by the requester.
const REVIEWS = [
  { orderIndex: 5, rating: 5, comment: "Super fast, thank you!" },
  { orderIndex: 6, rating: 4, comment: "Friendly and right on time." },
  { orderIndex: 7, rating: 5, comment: "Found everything — great service." },
  { orderIndex: 8, rating: 5, comment: "Lifesaver during exam week!" },
  { orderIndex: 9, rating: 4, comment: "Quick delivery, no fuss." },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function getOrCreateUser(u) {
  const created = await db.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      delivery_zone: u.zone,
    },
  });

  let id = created.data?.user?.id;
  if (!id) {
    // Probably already exists — find it.
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = data?.users?.find((x) => x.email === u.email)?.id;
    if (!id) throw created.error ?? new Error(`Could not create ${u.email}`);
  }

  // The handle_new_user trigger seeds the profile; finish it off.
  await db
    .from("profiles")
    .update({
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      delivery_zone: u.zone,
      onboarding_completed: true,
      is_verified: true,
      is_online: u.key === "dan", // one runner online for the demo
    })
    .eq("id", id);

  return id;
}

async function seedItems() {
  const { data: existing } = await db.from("items").select("name");
  const have = new Set((existing ?? []).map((i) => i.name));
  const missing = ITEMS.filter(([name]) => !have.has(name)).map(
    ([name, description, price, category]) => ({
      name,
      description,
      price,
      category,
    }),
  );
  if (missing.length) {
    const { error } = await db.from("items").insert(missing);
    if (error) throw error;
  }
  console.log(`✓ Catalogue: ${have.size} existing, ${missing.length} added`);

  const { data: all } = await db.from("items").select("id, name, price");
  return new Map((all ?? []).map((i) => [i.name, i]));
}

async function seedOrders(userIds, itemByName) {
  // Skip if already seeded (alice has orders).
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", userIds.alice);
  if (count && count > 0) {
    console.log("• Orders already seeded — skipping orders + reviews.");
    return;
  }

  const runnerEarnings = {}; // runnerId -> { count, total }
  const orderIds = [];

  for (const o of ORDERS) {
    const requesterId = userIds[o.req];
    const runnerId = o.runner ? userIds[o.runner] : null;
    const zone = USERS.find((u) => u.key === o.req).zone;

    const lines = o.items.map(([name, quantity]) => {
      const item = itemByName.get(name);
      if (!item) throw new Error(`Seed item not found: ${name}`);
      return { item, quantity };
    });
    const subtotal = lines.reduce((s, l) => s + l.item.price * l.quantity, 0);
    const f = fees(subtotal);

    const row = {
      requester_id: requesterId,
      runner_id: runnerId,
      status: o.status,
      delivery_zone: zone,
      delivery_address: `Flat ${4 + ORDERS.indexOf(o)}, Block C, ${zone}`,
      delivery_notes: o.status === "pending" ? "Text me when you're outside :)" : null,
      subtotal: f.subtotal,
      delivery_fee: f.delivery_fee,
      platform_fee: f.platform_fee,
      total: f.total,
      estimated_delivery_minutes: 25,
      created_at: ts(o.daysAgo, 0),
      accepted_at: ["accepted", "picking_up", "on_the_way", "delivered"].includes(o.status)
        ? ts(o.daysAgo, 5)
        : null,
      picked_up_at: ["picking_up", "on_the_way", "delivered"].includes(o.status)
        ? ts(o.daysAgo, 15)
        : null,
      delivered_at: o.status === "delivered" ? ts(o.daysAgo, 35) : null,
      cancelled_at: o.status === "cancelled" ? ts(o.daysAgo, 10) : null,
    };

    const { data: inserted, error } = await db
      .from("orders")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    orderIds.push(inserted.id);

    const lineRows = lines.map((l) => ({
      order_id: inserted.id,
      item_id: l.item.id,
      quantity: l.quantity,
      price_at_time: l.item.price,
    }));
    const { error: liErr } = await db.from("order_items").insert(lineRows);
    if (liErr) throw liErr;

    // Credit runner + payout for delivered orders (the delivery trigger only
    // fires on UPDATE, so do it here for directly-inserted seed rows).
    if (o.status === "delivered" && runnerId) {
      const agg = runnerEarnings[runnerId] ?? { count: 0, total: 0 };
      agg.count += 1;
      agg.total = round2(agg.total + f.delivery_fee);
      runnerEarnings[runnerId] = agg;

      await db.from("payouts").insert({
        runner_id: runnerId,
        order_id: inserted.id,
        amount: f.delivery_fee,
        status: "pending",
      });
    }
  }
  console.log(`✓ Orders: ${orderIds.length} inserted`);

  // Runner aggregate stats.
  for (const [runnerId, agg] of Object.entries(runnerEarnings)) {
    await db
      .from("profiles")
      .update({ total_deliveries: agg.count, total_earnings: agg.total })
      .eq("id", runnerId);
  }

  // Reviews (the handle_new_review trigger recomputes runner_rating + notifies).
  let reviewCount = 0;
  for (const r of REVIEWS) {
    const o = ORDERS[r.orderIndex];
    const { error } = await db.from("reviews").insert({
      order_id: orderIds[r.orderIndex],
      reviewer_id: userIds[o.req],
      reviewee_id: userIds[o.runner],
      rating: r.rating,
      comment: r.comment,
    });
    if (!error) reviewCount += 1;
  }
  console.log(`✓ Reviews: ${reviewCount} inserted`);
}

async function main() {
  console.log("Seeding DormDrop demo data…\n");

  const userIds = {};
  for (const u of USERS) {
    userIds[u.key] = await getOrCreateUser(u);
    console.log(`✓ User: ${u.full_name} (${u.role}) — ${u.email}`);
  }

  const itemByName = await seedItems();
  await seedOrders(userIds, itemByName);

  console.log("\n✅ Done.");
  console.log("   Test login — any user above, password: " + PASSWORD);
  console.log(
    "   To use the admin panel, run in SQL:\n" +
      "   update public.profiles set is_admin = true where email = 'alice@soton.ac.uk';",
  );
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
});
