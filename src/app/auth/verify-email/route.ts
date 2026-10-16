import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/email-verification";

// The link in the verification e-mail (sendEmailVerification) lands here. Opening it signs the
// address's owner in, which is the proof: the profile of THAT user is marked verified. A link
// opened by someone else's session would sign that session in as the address's owner, so the
// verified account is always the one the link was made for.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const supabase = await createClient();

  let userId: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) userId = data.user?.id ?? null;
  }

  if (!userId) return NextResponse.redirect(`${origin}/settings?verify=failed`);
  await markEmailVerified(userId);
  return NextResponse.redirect(`${origin}/settings?verify=done`);
}
