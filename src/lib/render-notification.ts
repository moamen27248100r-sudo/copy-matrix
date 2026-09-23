// Notification title/body used to be pre-rendered Arabic strings baked in
// at insert time by SQL triggers, so no amount of frontend translation work
// could change that text. Since migration 0168, new notifications also
// carry a `data` column with just the structured parameters (leader name,
// symbol, amounts -- proper nouns and numbers, nothing that itself needs
// translating), and this function renders title/body from `type` + `data`
// through the caller's translator, in whatever locale is currently active.
// Notifications from before that migration have `data: null`, so they fall
// back to their originally-stored (always Arabic) title/body.
type NotificationRow = {
  type: string;
  title: string;
  body: string | null;
  data?: Record<string, unknown> | null;
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function renderNotification(t: Translator, n: NotificationRow): { title: string; body: string | null } {
  // null/undefined means this row predates migration 0168 (no `data` column
  // yet) -- fall back to its originally-stored Arabic text. An empty object
  // is a deliberate, valid value (a type with no interpolated parameters).
  if (n.data == null) {
    return { title: n.title, body: n.body };
  }
  const d = n.data;
  // ICU select matches against the stringified value -- "true" for the
  // positive case, anything else (here always "false") falls through to
  // the message's "other" case.
  const sign = (v: unknown) => (v ? "true" : "false");

  switch (n.type) {
    case "copy_closed":
      return {
        title: t("copyClosedTitle", { providerName: String(d.providerName ?? "") }),
        body: t("copyClosedBody", { symbol: String(d.symbol ?? ""), amount: Number(d.amount ?? 0), positive: sign(d.positive) }),
      };
    case "auto_stop_copy":
      return {
        title: t("autoStopCopyTitle"),
        body: t("autoStopCopyBody", { maxDrawdownPct: Number(d.maxDrawdownPct ?? 0) }),
      };
    case "followed_trade_closed":
      return {
        title: t("followedTradeClosedTitle"),
        body: t("followedTradeClosedBody", { providerName: String(d.providerName ?? ""), symbol: String(d.symbol ?? ""), pct: Number(d.pct ?? 0), positive: sign(d.positive) }),
      };
    case "kyc_approved":
      return { title: t("kycApprovedTitle"), body: t("kycApprovedBody") };
    case "kyc_rejected":
      return { title: t("kycRejectedTitle"), body: t("kycRejectedBody") };
    case "wallet_deposit_approved":
      return { title: t("walletDepositApprovedTitle"), body: t("walletApprovedBody", { amount: Number(d.amount ?? 0) }) };
    case "wallet_withdrawal_approved":
      return { title: t("walletWithdrawalApprovedTitle"), body: t("walletApprovedBody", { amount: Number(d.amount ?? 0) }) };
    case "wallet_deposit_rejected":
      return { title: t("walletDepositRejectedTitle"), body: t("walletRejectedBody") };
    case "wallet_withdrawal_rejected":
      return { title: t("walletWithdrawalRejectedTitle"), body: t("walletRejectedBody") };
    default:
      return { title: n.title, body: n.body };
  }
}
