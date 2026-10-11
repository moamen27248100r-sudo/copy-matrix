import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SupportChatPage } from "@/components/SupportChatPage";
import { ExtraMessages } from "@/components/ExtraMessages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("pageTitle") };
}

export default function SupportPage() {
  return (
    <ExtraMessages namespaces={["Faq"]}>
      <SupportChatPage />
    </ExtraMessages>
  );
}
