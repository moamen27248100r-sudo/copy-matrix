import Link from "next/link";
import { chooseAccountType } from "@/app/auth/actions";

type AccountType = "real" | "demo";

const TABS: { key: AccountType; label: string }[] = [
  { key: "real", label: "حقيقي" },
  { key: "demo", label: "تجريبي" },
];

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12H15a2 2 0 0 0 0 4h6z" />
    </svg>
  );
}

export function AccountsSection({
  accountType,
  balance,
}: {
  accountType: AccountType;
  balance: number | null;
}) {
  return (
    <section id="accounts" className="flex flex-col gap-3 scroll-mt-20">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">حساباتي</h2>
        <select
          defaultValue="latest"
          aria-label="ترتيب الحسابات"
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-muted"
        >
          <option value="latest">الأحدث</option>
        </select>
      </div>

      <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) =>
          t.key === accountType ? (
            <span
              key={t.key}
              className="flex-1 rounded bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground"
            >
              {t.label}
            </span>
          ) : (
            <form key={t.key} action={chooseAccountType} className="flex-1">
              <input type="hidden" name="accountType" value={t.key} />
              <input type="hidden" name="next" value="/dashboard" />
              <button
                type="submit"
                className="w-full rounded px-3 py-2 text-sm text-muted transition hover:text-foreground"
              >
                {t.label}
              </button>
            </form>
          ),
        )}
      </div>

      <Link
        href="/portfolio"
        className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <WalletIcon />
          </div>
          <div>
            <p className="text-sm font-medium">
              {accountType === "real" ? "الحساب الحقيقي" : "الحساب التجريبي"}
            </p>
            <p className="text-xs text-muted">الحساب الرئيسي</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-lg font-semibold">
            ${balance != null ? Number(balance).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
          </p>
          <p className="text-xs text-muted">الرصيد المتاح</p>
        </div>
      </Link>
    </section>
  );
}
