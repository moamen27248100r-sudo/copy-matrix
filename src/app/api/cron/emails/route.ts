import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email-outbox";

// Sends the queued transactional emails. Called every minute by the database
// while the queue has work (pg_cron + pg_net, migration 0242, URL in the Vault
// secret `email_cron_url`); also usable as a Vercel Cron target. Both send
// "Authorization: Bearer <CRON_SECRET>".
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const result = await processEmailOutbox({ limit: 50, siteUrl });
  return NextResponse.json(result);
}
