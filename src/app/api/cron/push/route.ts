import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPushOutbox } from "@/lib/push-outbox";

// Sends the queued Web Push notifications. Called every minute by the database while the queue has
// work (pg_cron + pg_net, migration 0260); "Authorization: Bearer <CRON_SECRET>". Without the VAPID
// keys in the environment it does nothing and answers {configured:false}.
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
  return NextResponse.json(await processPushOutbox({ limit: 100 }));
}
