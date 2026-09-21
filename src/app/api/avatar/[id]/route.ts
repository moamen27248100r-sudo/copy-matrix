import { generateAvatarSvg, generateLeaderAvatarSvg } from "@/lib/avatar-svg";
import { createAdminClient } from "@/lib/supabase/admin";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const svg = (body: string, cache: string) =>
  new Response(body, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache } });

// The picture is a pure function of the leader (id + display name), so the
// browser and CDN cache it; a name edit shows up after the cache window.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return new Response("Bad avatar id", { status: 400 });
  }

  if (!UUID.test(id)) {
    return svg(generateAvatarSvg(id), "public, max-age=31536000, s-maxage=31536000, immutable");
  }

  // Service-role read of one column by primary key: the anon role can't read
  // the providers table directly, and this endpoint returns only the drawing.
  const { data, error } = await createAdminClient().from("providers").select("display_name").eq("id", id).maybeSingle();
  if (error) {
    // Don't let a transient failure pin a name-less fallback in caches.
    return svg(generateAvatarSvg(id), "public, max-age=60");
  }
  return svg(
    generateLeaderAvatarSvg(id, data?.display_name),
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
  );
}
