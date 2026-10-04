import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueDeposits } from "@/lib/crypto/deposits";

// Re-checks deposits still waiting for confirmations. Called every minute by the database
// (pg_cron + pg_net, migration 0233, reading the URL and secret from Supabase Vault) and also
// usable as a Vercel Cron target: both send "Authorization: Bearer <CRON_SECRET>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const checked = await processDueDeposits({ limit: 25 });
  return NextResponse.json({ checked });
}
