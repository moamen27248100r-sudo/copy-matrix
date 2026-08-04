import { readFileSync } from "node:fs";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql-file>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const sql = readFileSync(filePath, "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${filePath} applied successfully`);
} catch (err) {
  console.error(`FAILED: ${filePath}`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
