import Link from "next/link";

type Copier = {
  id: string;
  display_name: string;
  joined_at: string;
  current_capital: number;
  starting_capital?: number;
};

const AVATAR_STYLES = [
  "bg-accent/15 text-accent",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-brand/15 text-brand",
];

function avatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

export function RecentCopiersList({ copiers, providerId }: { copiers: Copier[]; providerId: string }) {
  if (copiers.length === 0) return null;

  return (
    <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pe-1">
      {copiers.map((c) => {
        const gainPct =
          c.starting_capital && c.starting_capital > 0
            ? ((Number(c.current_capital) - Number(c.starting_capital)) / Number(c.starting_capital)) * 100
            : null;

        return (
          <Link
            key={c.id}
            href={`/trader/${providerId}/copiers/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5 transition hover:border-accent/40 hover:bg-background"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${avatarStyle(c.display_name)}`}
              >
                {c.display_name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.display_name}</p>
                <p className="text-xs text-muted">
                  منذ{" "}
                  {new Date(c.joined_at).toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-end">
                <p className="text-sm font-bold text-foreground" dir="ltr">
                  ${Number(c.current_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                {gainPct != null && (
                  <p className={gainPct >= 0 ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"} dir="ltr">
                    {gainPct >= 0 ? "+" : ""}
                    {gainPct.toFixed(1)}%
                  </p>
                )}
              </div>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-muted rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
