import Link from "next/link";

// A row of tabs that are plain links (each tab is its own URL, so the back button and sharing work).
export function LinkTabs({ items, active }: { items: { key: string; href: string; label: string }[]; active: string }) {
  return (
    <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1" role="tablist">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          role="tab"
          aria-selected={active === item.key}
          className={
            active === item.key
              ? "flex-1 rounded bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground"
              : "flex-1 rounded px-3 py-2 text-center text-sm text-muted transition hover:text-foreground"
          }
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
