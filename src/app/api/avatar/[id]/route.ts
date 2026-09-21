import { generateAvatarSvg } from "@/lib/avatar-svg";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// The picture is a pure function of the id, so it can be cached forever by
// the browser and the CDN -- a page with 20 leaders costs 20 tiny (~2 KB)
// cached SVGs, not 20 renders.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return new Response("Bad avatar id", { status: 400 });
  }
  return new Response(generateAvatarSvg(id), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
