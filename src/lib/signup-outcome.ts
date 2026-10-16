// Where a sign-up leads, decided in one place (and tested): the account opens at once and the
// customer lands on the dashboard -- or back on the trader they came to copy. There is no step in
// between (no account-type page, no name or phone form).

export type SignUpResult = {
  error: { message: string } | null;
  data: { session: unknown | null; user: { identities?: unknown[] | null } | null };
};

export type SignupOutcome =
  | { kind: "go"; to: string }
  | { kind: "back"; code: "email_taken" | "generic"; message?: string };

export function signupOutcome(result: SignUpResult, next: string | null): SignupOutcome {
  if (result.error) {
    return /already registered/i.test(result.error.message)
      ? { kind: "back", code: "email_taken" }
      : { kind: "back", code: "generic", message: result.error.message };
  }
  // an address that already exists is hidden by some projects as a user without identities
  const identities = result.data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) return { kind: "back", code: "email_taken" };
  if (result.data.session) return { kind: "go", to: next ?? "/dashboard" };
  return { kind: "go", to: `/signup/check-email${next ? `?next=${encodeURIComponent(next)}` : ""}` };
}
