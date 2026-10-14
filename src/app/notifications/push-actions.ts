"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedLocale } from "@/i18n/locales";
import { headers } from "next/headers";

// A device's Web Push subscription. Written with the server's own key after the customer is
// verified: a device that moves to another account is simply reassigned (endpoint is unique).
export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; locale?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const endpoint = String(input.endpoint ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !input.p256dh || !input.auth) return { ok: false as const };

  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 300);
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        locale: isSupportedLocale(input.locale) ? input.locale : null,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", String(endpoint));
  return { ok: !error };
}
