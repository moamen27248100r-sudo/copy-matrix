import { nameIsolate } from "@/lib/format-stats";

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

// Prices in notices: 2 decimals from 1,000 up, 5 for forex-sized prices, 5 significant digits below 1.
function fmtNotifPrice(p: number): string {
  if (!Number.isFinite(p)) return "";
  if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 5 });
  return p.toLocaleString("en-US", { maximumSignificantDigits: 5 });
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

type Money = (value: number, opts?: { signed?: boolean }) => string;

export function renderNotification(t: Translator, n: NotificationRow, rawMoney: Money): { title: string; body: string | null } {
  // null/undefined means this row predates migration 0168 (no `data` column
  // yet) -- fall back to its originally-stored Arabic text. An empty object
  // is a deliberate, valid value (a type with no interpolated parameters).
  if (n.data == null) {
    return { title: n.title, body: n.body };
  }
  const d = n.data;
  // An amount inside right-to-left text must stay one left-to-right unit, otherwise "-$0.17" is
  // drawn as "$0.17-". U+2066 .. U+2069 isolate it without changing how it reads.
  const money: Money = (value, opts) => "⁦" + rawMoney(value, opts) + "⁩";
  // ICU select matches against the stringified value -- "true" for the
  // positive case, anything else (here always "false") falls through to
  // the message's "other" case.
  const sign = (v: unknown) => (v ? "true" : "false");

  switch (n.type) {
    case "copy_started":
      return {
        title: t("copyStartedTitle"),
        body: t("copyStartedBody", { providerName: nameIsolate(d.providerName), amount: money(Number(d.amount ?? 0)) }),
      };
    case "copy_stopped":
      return { title: t("copyStoppedTitle"), body: t("copyStoppedBody", { providerName: nameIsolate(d.providerName) }) };
    case "leader_stopped":
      return { title: t("leaderStoppedTitle"), body: t("leaderStoppedBody", { providerName: nameIsolate(d.providerName) }) };
    case "market_move": {
      const pct = Number(d.changePct ?? 0);
      const price = Number(d.price ?? 0);
      return {
        title: t("marketMoveTitle", { symbol: String(d.symbol ?? "") }),
        body: t("marketMoveBody", {
          symbol: String(d.symbol ?? ""),
          direction: pct >= 0 ? "up" : "down",
          pct: `${Math.abs(pct).toFixed(2)}%`,
          price: price >= 1000 ? price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Number(price.toFixed(price >= 10 ? 2 : 4))),
        }),
      };
    }
    case "security_new_login":
      return { title: t("securityNewLoginTitle"), body: t("securityNewLoginBody") };
    case "copy_opened":
      // Several opens of one trader merged by the database into a single notice (0256).
      if (Number(d.count ?? 1) > 1) {
        return {
          title: t("copyOpenedBulkTitle", { count: Number(d.count) }),
          body: t("copyOpenedBulkBody", { count: Number(d.count), providerName: nameIsolate(d.providerName) }),
        };
      }
      // Rows from before 0231 only carry symbol + side.
      if (d.providerName == null || d.size == null) {
        return {
          title: t("copyOpenedTitle"),
          body: t("copyOpenedBodyLegacy", { symbol: String(d.symbol ?? ""), side: String(d.side ?? "buy") }),
        };
      }
      return {
        title: t("copyOpenedTitle"),
        body: t("copyOpenedBody", {
          providerName: nameIsolate(d.providerName),
          symbol: String(d.symbol ?? ""),
          side: String(d.side ?? "buy"),
          size: money(Number(d.size)),
          price: fmtNotifPrice(Number(d.price ?? 0)),
        }),
      };
    case "copy_closed": {
      if (Number(d.count ?? 1) > 1) {
        return {
          title: t("copyClosedBulkTitle", { count: Number(d.count) }),
          body: t("copyClosedBulkBody", {
            count: Number(d.count),
            providerName: nameIsolate(d.providerName),
            amount: money(d.positive ? Number(d.amount ?? 0) : -Number(d.amount ?? 0), { signed: true }),
          }),
        };
      }
      const values = {
        providerName: nameIsolate(d.providerName),
        symbol: String(d.symbol ?? ""),
        amount: money(d.positive ? Number(d.amount ?? 0) : -Number(d.amount ?? 0), { signed: true }),
      };
      // Why it closed (0231): the take profit / stop loss / trailing stop the customer set,
      // their own manual close, or the trader closing the trade.
      const reason = ({ tp: "Tp", sl: "Sl", trailing: "Trailing", manual: "Manual", leader: "Leader" } as Record<string, string>)[String(d.reason ?? "")];
      if (!reason) return { title: t("copyClosedLeaderTitle", values), body: t("copyClosedBody", values) };
      return { title: t(`copyClosed${reason}Title`, values), body: t(`copyClosed${reason}Body`, values) };
    }
    // A copied trade opened with less than its share, or not opened, and why (migration 0263).
    case "copy_reduced":
      return {
        title: t("copyReducedTitle"),
        body: t("copyReducedBody", {
          providerName: nameIsolate(d.providerName),
          symbol: String(d.symbol ?? ""),
          opened: money(Number(d.opened ?? 0)),
          required: money(Number(d.required ?? 0)),
          available: money(Number(d.available ?? 0)),
        }),
      };
    case "copy_skipped":
      return {
        title: t("copySkippedTitle"),
        body: t(d.reason === "below_minimum_size" ? "copySkippedMinBody" : "copySkippedFreeBody", {
          providerName: nameIsolate(d.providerName),
          symbol: String(d.symbol ?? ""),
          available: money(Number(d.available ?? 0)),
        }),
      };
    case "auto_stop_copy":
      return {
        title: t("autoStopCopyTitle"),
        body: t("autoStopCopyBody", { maxDrawdownPct: Number(d.maxDrawdownPct ?? 0) }),
      };
    case "loss_alert":
      return {
        title: t("lossAlertTitle"),
        body:
          d.scope === "copy"
            ? t("lossAlertBodyCopy", { providerName: nameIsolate(d.providerName), loss: Number(d.lossPct ?? 0), threshold: Number(d.thresholdPct ?? 0) })
            : t("lossAlertBodyPortfolio", { loss: Number(d.lossPct ?? 0), threshold: Number(d.thresholdPct ?? 0) }),
      };
    case "followed_trade_closed":
      return {
        title: t("followedTradeClosedTitle"),
        body: t("followedTradeClosedBody", { providerName: nameIsolate(d.providerName), symbol: String(d.symbol ?? ""), pct: Number(d.pct ?? 0), positive: sign(d.positive) }),
      };
    case "followed_trade_opened":
      return {
        title: t("followedTradeOpenedTitle", { providerName: nameIsolate(d.providerName) }),
        body: t("followedTradeOpenedBody", { providerName: nameIsolate(d.providerName), symbol: String(d.symbol ?? ""), side: String(d.side ?? "buy") }),
      };
    case "kyc_approved":
      return { title: t("kycApprovedTitle"), body: t("kycApprovedBody") };
    case "kyc_rejected":
      return { title: t("kycRejectedTitle"), body: t("kycRejectedBody") };
    case "wallet_deposit_approved":
      return { title: t("walletDepositApprovedTitle"), body: t("walletApprovedBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "wallet_withdrawal_approved":
      return { title: t("walletWithdrawalApprovedTitle"), body: t("walletApprovedBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "wallet_deposit_rejected":
      return { title: t("walletDepositRejectedTitle"), body: t("walletRejectedBody") };
    case "wallet_withdrawal_rejected":
      // Crypto withdrawals (0233) are refunded on rejection; older manual requests were not.
      return { title: t("walletWithdrawalRejectedTitle"), body: d.network ? t("walletWithdrawalRefundedBody") : t("walletRejectedBody") };
    case "wallet_deposit_failed":
      return { title: t("walletDepositFailedTitle"), body: t("walletDepositFailedBody", { network: String(d.network ?? "") }) };
    case "lead_new_copier":
      return { title: t("leadNewCopierTitle"), body: t("leadNewCopierBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "lead_copier_stopped":
      return { title: t("leadCopierStoppedTitle"), body: t("leadCopierStoppedBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "lead_profit_paid":
      return { title: t("leadProfitPaidTitle"), body: t("leadProfitPaidBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "lead_status_changed":
      return { title: t("leadStatusChangedTitle"), body: t(`leadStatusChanged_${String(d.status ?? "active")}`) };
    case "lead_payout_reviewed":
      return { title: t(d.approved ? "leadPayoutApprovedTitle" : "leadPayoutRejectedTitle"), body: t("leadPayoutBody", { amount: money(Number(d.amount ?? 0)) }) };
    case "trade_integrity_alert":
      return { title: t("tradeIntegrityAlertTitle"), body: t("tradeIntegrityAlertBody", { issues: Number(d.issues ?? 0) }) };
    default:
      return { title: n.title, body: n.body };
  }
}
