import { generateAvatarSvg } from "@/lib/avatar-svg";
import { generateInitialsSvg } from "@/lib/avatar-initials";
import { createAdminClient } from "@/lib/supabase/admin";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const svg = (body: string, cache: string) =>
  new Response(body, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache } });

const FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

// Default: a generated trading-chart avatar, a pure function of the id (cached
// for good). `?k=i`: an initials badge built from the leader's display name
// (cached for a day so a rename shows up).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return new Response("Bad avatar id", { status: 400 });
  }

  const wantsInitials = new URL(request.url).searchParams.get("k") === "i";
  if (!wantsInitials || !UUID.test(id)) {
    return svg(generateAvatarSvg(id), FOREVER);
  }

  // Service-role read of one column by primary key: the anon role can't read
  // the providers table, and this endpoint returns only the drawing.
  const { data, error } = await createAdminClient().from("providers").select("display_name").eq("id", id).maybeSingle();
  const name = data?.display_name?.trim();
  if (error || !name) {
    // Don't let a transient failure pin the chart fallback in caches.
    return svg(generateAvatarSvg(id), "public, max-age=60");
  }
  return svg(generateInitialsSvg(id, name), "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800");
}
