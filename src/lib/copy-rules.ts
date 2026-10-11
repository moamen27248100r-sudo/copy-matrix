// Why a copy cannot be started, decided from facts the page already has so the dialog can say it up
// front. It mirrors the database (migration 0252: copy_check_leader_account + start_or_update_copy),
// which stays the authority and refuses with the same reasons.
//
//   leader_demo_only        CM050  deposits are on, the leader is simulated, the account is real
//   not_accepting_followers CM051  the leader takes no new copiers (starting only)
//   kyc_required            CM052  deposits are on, a real account without an approved KYC (starting only)

export type CopyRefusal = "leader_demo_only" | "not_accepting_followers" | "kyc_required";

export type CopyFacts = {
  /** true when this would start a new copy (false: editing a running one). */
  isStarting: boolean;
  depositsEnabled: boolean;
  accountType: "real" | "demo";
  leaderSimulated: boolean;
  /** lead_trader_profiles.accepting_followers; null/undefined = no profile = accepting. */
  leaderAcceptingFollowers: boolean | null | undefined;
  kycApproved: boolean;
};

export function copyRefusal(f: CopyFacts): CopyRefusal | null {
  if (f.depositsEnabled && f.leaderSimulated && f.accountType !== "demo") return "leader_demo_only";
  if (f.isStarting && f.leaderAcceptingFollowers === false) return "not_accepting_followers";
  if (f.isStarting && f.depositsEnabled && f.accountType === "real" && !f.kycApproved) return "kyc_required";
  return null;
}

export const COPY_REFUSAL_CODES: Record<CopyRefusal, string> = {
  leader_demo_only: "CM050",
  not_accepting_followers: "CM051",
  kyc_required: "CM052",
};
