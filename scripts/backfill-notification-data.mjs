// One-time: populate `data` for notification rows created before migration
// 0168 (data column added), so renderNotification() can translate them too
// instead of falling back to their originally-stored Arabic text forever.
// Parses each row's own stored (always Arabic) title/body -- the fixed
// templates close_simulated_positions()/notify_kyc_status_change()/
// apply_wallet_request() have always used -- back into the same structured
// params those functions now write directly into `data` for new rows.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const dryRun = process.argv.includes("--dry-run");

function parse(type, title, body) {
  switch (type) {
    case "copy_opened": {
      const m = body.match(/^تم نسخ صفقة (\S+) \((شراء|بيع)\) من متداول تتابعه\.$/);
      if (!m) return null;
      return { symbol: m[1], side: m[2] === "بيع" ? "sell" : "buy" };
    }
    case "copy_closed": {
      // Two historical title variants: an earlier generic one with no name
      // at all, and the current "صفقة منسوخة من {name}" -- both map to the
      // same fallback ("متداول") close_simulated_positions() itself uses
      // today when providerName is null.
      const tm = title.match(/^صفقة منسوخة من (.+)$/);
      const bm = body.match(/^أُغلقت صفقة (\S+) بنتيجة ([+-]?)([\d.,]+)\$$/);
      if (!bm) return null;
      return {
        providerName: tm ? tm[1] : "متداول",
        symbol: bm[1],
        amount: Number(bm[3].replace(/,/g, "")),
        positive: bm[2] !== "-",
      };
    }
    case "followed_trade_closed": {
      const bm = body.match(/^(.+?) أغلق صفقة (\S+) بنتيجة ([+-]?)([\d.]+)%$/);
      if (!bm) return null;
      return {
        providerName: bm[1],
        symbol: bm[2],
        pct: Number(bm[4]),
        positive: bm[3] !== "-",
      };
    }
    case "auto_stop_copy": {
      const bm = body.match(/\((\d+(?:\.\d+)?)%\)/);
      if (!bm) return null;
      return { maxDrawdownPct: Number(bm[1]) };
    }
    case "wallet_deposit_approved":
    case "wallet_withdrawal_approved": {
      const bm = body.match(/بمبلغ ([\d.,]+)\$/);
      if (!bm) return null;
      return { amount: Number(bm[1].replace(/,/g, "")) };
    }
    case "kyc_approved":
    case "kyc_rejected":
    case "wallet_deposit_rejected":
    case "wallet_withdrawal_rejected":
      return {}; // no interpolated params for these -- {} marks the row as migrated
    default:
      return null; // unknown type -- leave data null, keep the Arabic fallback
  }
}

const { rows } = await client.query(
  `select id, type, title, body from public.notifications where data is null`,
);

let updated = 0;
let unparsed = 0;
const updates = [];
for (const r of rows) {
  const data = parse(r.type, r.title, r.body ?? "");
  if (data == null) {
    unparsed++;
    console.log(`UNPARSED [${r.type}] title="${r.title}" body="${r.body}"`);
    continue;
  }
  updates.push({ id: r.id, data });
  updated++;
}

console.log(`\n${rows.length} rows with null data -- parsed ${updated}, unparsed ${unparsed}`);
if (updates.length > 0) {
  console.log("sample:", JSON.stringify(updates.slice(0, 5), null, 2));
}

if (!dryRun && updates.length > 0) {
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await client.query(
      `update public.notifications n
       set data = c.data
       from (select * from jsonb_to_recordset($1::jsonb) as x(id uuid, data jsonb)) c
       where n.id = c.id`,
      [JSON.stringify(chunk)],
    );
  }
  console.log(`\nApplied ${updates.length} updates.`);
} else if (dryRun) {
  console.log("\n(dry run -- no writes made)");
}

await client.end();
