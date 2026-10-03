import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Follower invite link: /i/<code> -> marks the invite used and sends the
// visitor straight to that trader's copy dialog.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/i/${code}`)}`, request.url));
  }

  const { data: providerId } = await supabase.rpc("accept_follower_invite", { p_code: code });
  if (!providerId) {
    return NextResponse.redirect(new URL("/discover?error=" + encodeURIComponent((await getTranslations("Actions.discover"))("inviteInvalid")), request.url));
  }

  return NextResponse.redirect(new URL(`/trader/${providerId}#copy`, request.url));
}
