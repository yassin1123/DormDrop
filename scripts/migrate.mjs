/**
 * Run all SQL migrations against a Supabase Postgres database, in order.
 *
 * Usage (either of):
 *   node scripts/migrate.mjs "postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres"
 *   # or put SUPABASE_DB_URL=... in .env.local, then:
 *   node scripts/migrate.mjs
 *
 * Get the connection string from Supabase → Project Settings → Database →
 * Connection string (Session pooler or Direct connection), replacing
 * [YOUR-PASSWORD] with your database password.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

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
const connectionString = process.argv[2] || env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error(
    "✗ No database connection string.\n" +
      "  Pass it as an argument, or set SUPABASE_DB_URL in .env.local.\n" +
      "  Supabase → Settings → Database → Connection string (URI).",
  );
  process.exit(1);
}

const dir = resolve(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log(`Connecting…`);
  await client.connect();
  console.log(`Connected. Running ${files.length} migrations:\n`);

  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    process.stdout.write(`  • ${file} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      throw new Error(`${file}: ${err.message}`);
    }
  }

  console.log("\n✅ All migrations applied.");
}

main()
  .catch((err) => {
    console.error("\n✗ Migration failed:", err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
