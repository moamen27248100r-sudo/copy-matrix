import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SupportChatPage } from "@/components/SupportChatPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("pageTitle") };
}

export default function SupportPage() {
  return <SupportChatPage />;
}
