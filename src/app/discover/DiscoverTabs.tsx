import { getTranslations } from "next-intl/server";
import { LinkTabs } from "@/components/LinkTabs";

// "Traders | Markets": the two views of Discover. Only a signed-in customer sees the Markets tab.
export async function DiscoverTabs({ active }: { active: "traders" | "markets" }) {
  const t = await getTranslations("Discover");
  return (
    <LinkTabs
      active={active}
      items={[
        { key: "traders", href: "/discover", label: t("tabTraders") },
        { key: "markets", href: "/discover?tab=markets", label: t("tabMarkets") },
      ]}
    />
  );
}
