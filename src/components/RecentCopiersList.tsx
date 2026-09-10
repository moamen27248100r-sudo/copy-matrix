type Copier = {
  id: string;
  display_name: string;
  joined_at: string;
  current_capital: number;
};

export function RecentCopiersList({ copiers }: { copiers: Copier[] }) {
  if (copiers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {copiers.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium">
              {c.display_name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{c.display_name}</p>
              <p className="text-xs text-muted">
                منذ{" "}
                {new Date(c.joined_at).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
          <p className="text-sm font-semibold text-end" dir="ltr">
            ${Number(c.current_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
      ))}
    </div>
  );
}
