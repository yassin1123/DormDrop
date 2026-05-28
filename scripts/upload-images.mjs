/**
 * Upload product images to Supabase Storage and point the catalogue at them.
 *
 *   1. Reads every image in /images
 *   2. Ensures a public Storage bucket "products" exists
 *   3. Uploads each image (upsert / overwrite)
 *   4. Sets items.image_url to the public Storage URL, matching by item name
 *
 * Run from the project root:
 *   node scripts/upload-images.mjs       (or: npm run upload-images)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

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
    // no .env.local
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BUCKET = "products";
const IMAGES_DIR = resolve(process.cwd(), "images");

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

// filename stem (lowercase, no extension) → catalogue item name
const NAME_BY_FILE = {
  "doritos-cool-original": "Doritos (Cool Original)",
  "pringles-original": "Pringles (Original)",
  "cadbury-dairy-milk": "Cadbury Dairy Milk",
  "kit-kat-chunky": "Kit Kat Chunky",
  "haribo-tangfastics": "Haribo Tangfastics",
  "mccoys-flame-grilled-steak": "McCoy's (Flame Grilled Steak)",
  "walkers-cheese-onion": "Walkers (Cheese & Onion)",
  "galaxy-caramel": "Galaxy Caramel",
  "percy-pigs": "Percy Pigs",
  snickers: "Snickers",
  "red-bull-250ml": "Red Bull (250ml)",
  "monster-energy": "Monster Energy",
  "coca-cola-500ml": "Coca-Cola (500ml)",
  "lucozade-original": "Lucozade Original",
  ribena: "Ribena",
  "volvic-water-1l": "Volvic Water (1L)",
  "oasis-citrus-punch": "Oasis Citrus Punch",
  "tropicana-orange": "Tropicana Orange Juice",
  paracetamol: "Paracetamol",
  "toilet-roll-4pack": "Toilet Roll (4-pack)",
  "washing-up-liquid": "Washing Up Liquid",
  "bin-bags": "Bin Bags",
  "kitchen-roll": "Kitchen Roll",
  "milk-1pint": "Milk (1 pint)",
  "black-biro-pens": "Black Biro Pens (pack of 5)",
  "a4-notebook": "A4 Notebook",
  "highlighters-4pack": "Highlighters (pack of 4)",
  "usb-c-cable": "USB-C Cable",
  toothpaste: "Toothpaste",
  "deodorant-sure": "Deodorant (Sure)",
  "hand-sanitiser": "Hand Sanitiser",
};

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureBucket() {
  const { data: buckets, error } = await db.storage.listBuckets();
  if (error) throw error;
  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`• Bucket "${BUCKET}" already exists`);
    return;
  }
  const { error: createError } = await db.storage.createBucket(BUCKET, {
    public: true,
  });
  if (createError) throw createError;
  console.log(`✓ Created public bucket "${BUCKET}"`);
}

async function main() {
  let files;
  try {
    files = readdirSync(IMAGES_DIR).filter(
      (f) => CONTENT_TYPES[extname(f).toLowerCase()],
    );
  } catch {
    console.error(`✗ No /images folder found at ${IMAGES_DIR}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`✗ No image files found in ${IMAGES_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} image(s) in /images\n`);
  await ensureBucket();
  console.log("");

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const stem = basename(file, ext).toLowerCase();
    const itemName = NAME_BY_FILE[stem];

    if (!itemName) {
      console.warn(`  ⚠ ${file} — no item mapping, skipped`);
      skipped += 1;
      continue;
    }

    const buffer = readFileSync(resolve(IMAGES_DIR, file));
    const path = `${stem}${ext}`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: CONTENT_TYPES[ext],
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadError) {
      console.error(`  ✗ ${file} — upload failed: ${uploadError.message}`);
      continue;
    }
    uploaded += 1;

    const {
      data: { publicUrl },
    } = db.storage.from(BUCKET).getPublicUrl(path);

    const { data: rows, error: updateError } = await db
      .from("items")
      .update({ image_url: publicUrl })
      .eq("name", itemName)
      .select("id");

    if (updateError) {
      console.error(`  ✗ "${itemName}" — db update failed: ${updateError.message}`);
      continue;
    }
    if (!rows || rows.length === 0) {
      console.warn(
        `  ⚠ uploaded ${file} but no catalogue item named "${itemName}"`,
      );
      continue;
    }
    updated += 1;
    console.log(`  ✓ ${file} → "${itemName}"`);
  }

  console.log(
    `\n✅ Done. Uploaded ${uploaded}, catalogue rows updated ${updated}` +
      (skipped ? `, skipped ${skipped}` : "") +
      ".",
  );
}

main().catch((err) => {
  console.error("\n✗ Upload failed:", err.message ?? err);
  process.exit(1);
});
