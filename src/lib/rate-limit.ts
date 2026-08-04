import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function checkRateLimit(action: string, maxAttempts: number, windowSeconds: number) {
  const supabase = await createClient();
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: `${action}:${ip}`,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (error) return true;
  return data as boolean;
}
