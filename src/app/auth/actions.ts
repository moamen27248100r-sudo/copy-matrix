"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerified } from "@/lib/email-verification";
import { translateAuthError } from "@/lib/auth-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidEmailFormat } from "@/lib/validate-signup";
import { checkPassword, PASSWORD_MIN } from "@/lib/password-policy";
import { signupOutcome } from "@/lib/signup-outcome";
import { clearLoginFailures, emailActionAllowed, loginBlocked, normalizeEmail, recordLoginFailure } from "@/lib/auth-limits";
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
  // The address is compared trimmed and lowercase everywhere, so "  Name@Mail.com " is the same account.
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  // Too many wrong passwords for this address (from any network address): paused for a while.
  if (email && (await loginBlocked(email))) {
    redirect(`/login?error=${encodeURIComponent(ta("tooManyFailedLogins"))}${nextParam}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get("password") as string,
  });

  if (error) {
    if (email && /Invalid login credentials/i.test(error.message)) await recordLoginFailure(email);
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message, ta))}${nextParam}`);
  }
  if (email) await clearLoginFailures(email);

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

// One step: an e-mail and a password open the account and the dashboard (on the practice account).
// The name and the phone number are asked later, on the account and verification pages. Every
// failure comes back to the form as a code (?code=) and is shown under the field it belongs to.
export async function signup(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string);
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const back = (code: string): never => redirect(`/signup?code=${code}&email=${encodeURIComponent(email)}${nextParam}`);

  if (!(await checkRateLimit("signup", 5, 600)) || !(await emailActionAllowed("signup", email || "-", 3, 900))) {
    redirect(`/signup?error=${encodeURIComponent(t("rateLimit"))}${nextParam}`);
  }

  // One plain code for every way the e-mail can fail (not an e-mail at all, a domain that can't
  // receive mail, or a one-letter typo of a major provider): it doesn't reveal which check failed.
  if (!isValidEmailFormat(email)) back("email_invalid");
  const emailDomain = email.split("@")[1]?.trim();
  if (!emailDomain || !(await domainCanReceiveEmail(emailDomain))) back("email_invalid");
  if (likelyTypoOfKnownProvider(emailDomain)) back("email_invalid");

  if (password.length < PASSWORD_MIN) back("password_short");
  const issue = await checkPassword(password, email);
  if (issue) back(`password_${issue}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_type: "demo",
        // Language of the app's own emails.
        locale: await getLocale(),
      },
    },
  });

  const outcome = signupOutcome({ error, data }, next);
  if (outcome.kind === "back") {
    if (outcome.code === "email_taken") back("email_taken");
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(outcome.message ?? "", ta))}&email=${encodeURIComponent(email)}${nextParam}`);
  }

  // The account is open at once: record where it came from, then straight to the dashboard (or back
  // to the trader they came to copy / follow).
  if (data.session) {
    const { ip, country } = await getRequestIpAndCountry();
    await supabase
      .from("profiles")
      .update({ signup_ip: ip, last_login_ip: ip, country, last_seen_at: new Date().toISOString(), login_count: 1, locale: await getLocale() })
      .eq("id", data.user!.id);
  }
  redirect(outcome.to);
}

// The account switcher in the side menu is the one place that changes between the practice and the
// real account. Each wallet is kept separately; switching never mixes the funds.
export async function switchAccountType(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";

  // This swaps which wallet is active (stopping any copies of the old account).
  const { error: switchError } = await supabase.rpc("switch_account_type", { p_type: accountType });
  if (switchError) {
    const tSettings = await getTranslations("Actions.settings");
    redirect(
      "/portfolio?error=" +
        encodeURIComponent(switchError.code === "CM010" ? tSettings("accountSwitchOpenPositions") : tSettings("accountTypeUpdateFailed")),
    );
  }

  // Every page, the header and the notification counter belong to the active account: drop the
  // client router cache so nothing from the other account stays on screen.
  revalidatePath("/", "layout");
  redirect(next ?? "/dashboard");
}

const PASSWORD_ISSUE_KEYS = {
  short: "passwordMin8Error",
  common: "passwordCommonError",
  email: "passwordEmailError",
  breached: "passwordBreachedError",
} as const;

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

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  // by network address and by e-mail address: nobody can flood one customer's inbox
  if (!(await checkRateLimit("password-reset", 5, 900)) || !(await emailActionAllowed("password-reset", email || "-", 3, 900))) {
    redirect(`/forgot-password?error=${encodeURIComponent(t("rateLimit"))}`);
  }

  const supabase = await createClient();
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
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = ((formData.get("code") as string) ?? "").trim();
  const backTo = `/forgot-password/verify-code?email=${encodeURIComponent(email)}`;
  const t = await getTranslations("Actions");
  const ta = await getTranslations("Actions.auth");

  if (!(await checkRateLimit("verify-reset-code", 8, 900)) || !(await emailActionAllowed("verify-reset-code", email || "-", 8, 900))) {
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
  const issue = await checkPassword(password ?? "", user.email);
  if (issue) {
    redirect(`/reset-password?error=${encodeURIComponent(tAuth(PASSWORD_ISSUE_KEYS[issue]))}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(translateAuthError(error.message, ta))}`);
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------------------------
// E-mail verification. The platform opens accounts at once, so the address is proved afterwards:
// we send a one-time link / code to it (Supabase's own mail, "sign in once to this address") and
// the customer's profile is marked verified when it is used (route /auth/verify-email, or the
// code below). Real deposits and withdrawals need it (database rule, migration 0270).
export async function sendEmailVerification(formData?: FormData) {
  const back = formData?.get("returnTo") === "/dashboard" ? "/dashboard" : "/settings";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const t = await getTranslations("Actions");

  if (!(await emailActionAllowed("verify-mail", user.email, 3, 3600))) {
    redirect(`${back}?verify=limit`);
  }
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl}/auth/verify-email` },
  });
  if (error) {
    console.error("send verification failed:", error.message);
    redirect(`${back}?verify=failed`);
  }
  void t;
  redirect(`${back}?verify=sent`);
}

export async function verifyEmailCode(formData: FormData) {
  const back = formData.get("returnTo") === "/dashboard" ? "/dashboard" : "/settings";
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!/^\d{6,8}$/.test(code)) redirect(`${back}?verify=code_invalid`);
  if (!(await emailActionAllowed("verify-code", user.email, 8, 900))) redirect(`${back}?verify=limit`);

  const { data, error } = await supabase.auth.verifyOtp({ email: user.email, token: code, type: "email" });
  if (error || data.user?.id !== user.id) redirect(`${back}?verify=code_invalid`);
  await markEmailVerified(user.id);
  revalidatePath("/", "layout");
  redirect(`${back}?verify=done`);
}
