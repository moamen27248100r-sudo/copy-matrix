import { getTranslations } from "next-intl/server";
import { Layers, Search, SlidersHorizontal } from "lucide-react";

// Recent changes to the platform, newest first (update this list when a customer-facing feature ships).
const ITEMS = [
  { key: "whatsNew1", Icon: Layers },
  { key: "whatsNew2", Icon: Search },
  { key: "whatsNew3", Icon: SlidersHorizontal },
] as const;

export async function WhatsNew() {
  const t = await getTranslations("Dashboard");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{t("whatsNewTitle")}</h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {ITEMS.map(({ key, Icon }) => (
          <li key={key} className="flex gap-3 rounded-[20px] border border-border bg-surface p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{t(`${key}Title`)}</span>
              <span className="mt-1 block text-sm text-muted">{t(`${key}Desc`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
