import { type NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/email-verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/safe-next";

// Google sign-in returns here. The same e-mail address signs in to the same account (Supabase links
// the Google identity to the existing user by their verified address), a new address opens a new
// practice account. Google has verified the address, so the profile is marked verified.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      const google = user?.identities?.find((i) => i.provider === "google");
      if (user && google && (google.identity_data as { email_verified?: boolean } | undefined)?.email_verified !== false) {
        await markEmailVerified(user.id);
      }
      // A brand new account starts in the language the visitor was using.
      if (user && Date.now() - new Date(user.created_at).getTime() < 2 * 60_000) {
        await createAdminClient().from("profiles").update({ locale: await getLocale() }).eq("id", user.id);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const ta = await getTranslations("Actions.auth");
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(ta("googleSignInFailed"))}`);
}
