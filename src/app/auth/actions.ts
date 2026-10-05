"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateAuthError } from "@/lib/auth-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidEmailFormat, isValidPhoneForCountry, stripTrunkZero } from "@/lib/validate-signup";
import { domainCanReceiveEmail, likelyTypoOfKnownProvider } from "@/lib/email-domain-check";
import { safeNextPath } from "@/lib/safe-next";
import { getPendingMfa, MFA_CHALLENGE_PATH, MFA_PENDING_LOGIN_COOKIE } from "@/lib/mfa";
import { getRequestIpAndCountry } from "@/lib/request-ip";

async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function login(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string);
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");

  if (!(await checkRateLimit("login", 10, 300))) {
    redirect(`/login?error=${encodeURIComponent(t("rateLimit"))}${nextParam}`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message, ta))}${nextParam}`);
  }

  // 2FA on: the password only gets an aal1 session -- the proxy holds every
  // page until the authenticator code on /login/mfa steps it up to aal2.
  // record_login writes the profile, which RLS only allows at aal2 for these
  // accounts, so verifyMfaLogin records the login once the code is accepted.
  if ((await getPendingMfa(supabase, data.user)).pending) {
    (await cookies()).set(MFA_PENDING_LOGIN_COOKIE, "1", { httpOnly: true, path: "/", maxAge: 600, sameSite: "lax" });
    redirect(next ? `${MFA_CHALLENGE_PATH}?next=${encodeURIComponent(next)}` : MFA_CHALLENGE_PATH);
  }

  const { ip, country } = await getRequestIpAndCountry();
  await supabase.rpc("record_login", { p_ip: ip, p_country: country });

  redirect(next ?? "/dashboard");
}

export async function signup(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string);
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");
  const tAuth = await getTranslations("Auth");

  if (!(await checkRateLimit("signup", 5, 600))) {
    redirect(`/signup?error=${encodeURIComponent(t("rateLimit"))}${nextParam}`);
  }

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";
  const phoneCountryCode = (formData.get("phoneCountryCode") as string) ?? "";
  const phoneCountryIso = (formData.get("phoneCountryIso") as string) ?? "";
  const phoneNumber = stripTrunkZero(((formData.get("phoneNumber") as string) ?? "").replace(/\D/g, ""));
  const email = (formData.get("email") as string) ?? "";

  // One plain message for every way the email can fail (not an email at
  // all, a domain that can't receive mail, or a one-letter typo of a
  // major provider) — deliberately doesn't reveal which specific check
  // failed or suggest a "did you mean" domain.
  const EMAIL_ERROR = ta("emailInvalidGeneric");

  if (!isValidEmailFormat(email)) {
    redirect(`/signup?error=${encodeURIComponent(EMAIL_ERROR)}${nextParam}`);
  }

  // Format alone lets through syntactically valid but non-existent domains
  // (e.g. "user@example.com") — reject unless the domain can actually
  // receive mail.
  const emailDomain = email.split("@")[1]?.trim();
  if (!emailDomain || !(await domainCanReceiveEmail(emailDomain))) {
    redirect(`/signup?error=${encodeURIComponent(EMAIL_ERROR)}${nextParam}`);
  }

  // A typo of a well-known provider (e.g. "hgmail.com") is a real,
  // registered domain with its own mail servers — the check above passes
  // it, but it's almost certainly not the address the customer meant to
  // type, and they'd lose access to the account they just created.
  if (likelyTypoOfKnownProvider(emailDomain)) {
    redirect(`/signup?error=${encodeURIComponent(EMAIL_ERROR)}${nextParam}`);
  }

  if (!isValidPhoneForCountry(phoneNumber, phoneCountryIso)) {
    redirect(`/signup?error=${encodeURIComponent(tAuth("phoneInvalidError"))}${nextParam}`);
  }

  const phone = `${phoneCountryCode}${phoneNumber}`;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        display_name: formData.get("displayName") as string,
        account_type: accountType,
        phone,
        // Language of the confirmation email and of the app's own emails.
        locale: await getLocale(),
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(error.message, ta))}${nextParam}`);
  }

  const onboardingNext = next ? `?next=${encodeURIComponent(next)}` : "";

  // If email confirmation isn't required, signUp() already returns an
  // active session — skip the "check your email" step entirely and let
  // the customer choose demo vs. real before landing on the dashboard
  // (or back on the trader they came to copy/follow, if any).
  if (data.session) {
    // Only reachable with a live session, so RLS (profiles_update_own)
    // lets this through. If email confirmation is required instead,
    // there's no session yet to attribute this to -- their first login
    // captures the same fields via record_login, nothing is lost.
    const { ip, country } = await getRequestIpAndCountry();
    await supabase
      .from("profiles")
      .update({ signup_ip: ip, last_login_ip: ip, country, last_seen_at: new Date().toISOString(), login_count: 1 })
      .eq("id", data.user!.id);

    redirect(`/onboarding/account-type${onboardingNext}`);
  }

  redirect(`/signup/check-email${onboardingNext}`);
}

export async function chooseAccountType(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";

  // Demo and real wallets are kept separately; this swaps which one is active
  // (stopping any copies of the old account) without ever mixing the funds.
  const { error: switchError } = await supabase.rpc("switch_account_type", { p_type: accountType });
  if (switchError) {
    const tSettings = await getTranslations("Actions.settings");
    redirect(
      "/portfolio?error=" +
        encodeURIComponent(switchError.code === "CM010" ? tSettings("accountSwitchOpenPositions") : tSettings("accountTypeUpdateFailed")),
    );
  }
  // onboarding_completed has no direct-client UPDATE grant.
  await createAdminClient().from("profiles").update({ onboarding_completed: true }).eq("id", user.id);

  redirect(next ?? "/dashboard?onboarded=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Land on the public homepage, not /login -- its nav is unconditional
  // (always shows "Sign up"/"Log in", never an account menu) and this is
  // a Server Action redirect, so the whole page re-renders fresh against
  // the now-signed-out session -- no separate client-state sync needed.
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");

  if (!(await checkRateLimit("password-reset", 5, 900))) {
    redirect(`/forgot-password?error=${encodeURIComponent(t("rateLimit"))}`);
  }

  const supabase = await createClient();
  const email = formData.get("email") as string;
  const siteUrl = await getSiteUrl();

  // The email carries both a clickable link (works if opened on the same
  // browser/device that requested it -- PKCE, see /auth/confirm) AND a
  // 6-digit code (device-independent: verifyResetCode below exchanges it for
  // a session via verifyOtp, no cookie continuity required). The code is the
  // one that actually works when the link is opened from a phone's mail app
  // while the request came from a desktop browser.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(translateAuthError(error.message, ta))}`);
  }

  redirect(`/forgot-password/verify-code?email=${encodeURIComponent(email)}`);
}

export async function verifyResetCode(formData: FormData) {
  const email = (formData.get("email") as string) ?? "";
  const code = ((formData.get("code") as string) ?? "").trim();
  const backTo = `/forgot-password/verify-code?email=${encodeURIComponent(email)}`;
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");

  if (!(await checkRateLimit("verify-reset-code", 8, 900))) {
    redirect(`${backTo}&error=${encodeURIComponent(t("rateLimit"))}`);
  }
  if (!email || !/^\d{8}$/.test(code)) {
    redirect(`${backTo}&error=${encodeURIComponent(ta("codeMustBe8Digits"))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });

  if (error) {
    redirect(`${backTo}&error=${encodeURIComponent(ta("codeIncorrectOrExpired"))}`);
  }

  redirect("/reset-password");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ta = await getTranslations("Actions.auth");

  if (!user) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent(ta("resetLinkExpired")),
    );
  }

  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("passwordConfirm") as string;
  const tAuth = await getTranslations("Auth");

  // The form already disables submit on a mismatch client-side; this is the
  // server-side backstop for anyone who bypasses that (JS disabled, a direct
  // POST, ...).
  if (password !== passwordConfirm) {
    redirect(`/reset-password?error=${encodeURIComponent(tAuth("passwordMismatch"))}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(translateAuthError(error.message, ta))}`);
  }

  redirect("/dashboard");
}
