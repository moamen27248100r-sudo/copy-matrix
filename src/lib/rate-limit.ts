import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs with the service role: check_rate_limit is closed to browsers (migration 0245), otherwise
// anyone holding the public anon key could burn another person's bucket (lock a victim out of
// login or 2FA) or flood the rate_limits table.
export async function checkRateLimit(action: string, maxAttempts: number, windowSeconds: number) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${action}:${ip}`,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) return true;
  return data as boolean;
}
