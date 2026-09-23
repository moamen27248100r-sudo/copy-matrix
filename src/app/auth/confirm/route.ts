import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Lands here from Supabase's own hosted verify page after it checks the
// token from an emailed link (currently: password recovery only, see
// requestPasswordReset in src/app/auth/actions.ts). Both this app's Supabase
// clients are configured for the PKCE flow, so the normal case is a `code`
// query param -- exchanged for a session exactly like /auth/callback already
// does for Google sign-in. `token_hash`/`type` is kept as a fallback for the
// OTP-style delivery (a custom {{ .TokenHash }} email template would produce
// that instead), since both are cheap to support and only one will ever be
// present on a given link.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  // Bug fix: an un-encoded Arabic string here throws
  // "Cannot convert argument to a ByteString" when Next turns this into a
  // Location header (non-Latin1 characters aren't legal in an HTTP header
  // value), producing a 500 instead of the intended redirect.
  const ta = await getTranslations("Actions.auth");
  redirect(`/login?error=${encodeURIComponent(ta("confirmLinkInvalid"))}`);
}
