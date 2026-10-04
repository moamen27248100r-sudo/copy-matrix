// Back-office labels for the crypto wallet (the admin panel is Arabic-only by convention).

export const ADMIN_DEPOSIT_STATUS: Record<string, string> = {
  pending: "بانتظار التأكيدات",
  completed: "مكتمل",
  failed: "فشل",
};

export const ADMIN_WITHDRAWAL_STATUS: Record<string, string> = {
  processing: "قيد المعالجة",
  sending: "جارٍ الإرسال",
  completed: "مكتمل",
  rejected: "مرفوض",
  cancelled: "ألغاه العميل",
};

export const ADMIN_DEPOSIT_FAILURE: Record<string, string> = {
  not_found: "العملية غير موجودة على الشبكة المختارة",
  wrong_recipient: "المستلم ليس عنوان الإيداع",
  wrong_token: "ليست USDT على هذه الشبكة (عقد مختلف أو عملة أخرى)",
  tx_failed: "العملية فاشلة على البلوكتشين",
  below_minimum: "المبلغ أقل من الحد الأدنى للإيداع",
  expired: "لم تكتمل التأكيدات في الوقت المحدد",
};

export const ADMIN_STATUS_TONE: Record<string, string> = {
  completed: "border-success/40 text-success",
  failed: "border-danger/40 text-danger",
  rejected: "border-danger/40 text-danger",
  cancelled: "border-border text-muted",
  pending: "border-warning/40 text-warning",
  processing: "border-warning/40 text-warning",
  sending: "border-accent/40 text-accent",
};
