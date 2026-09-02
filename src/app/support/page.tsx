import type { Metadata } from "next";
import { SupportChatPage } from "@/components/SupportChatPage";

export const metadata: Metadata = {
  title: "الدعم الفني — Copy Matrix",
};

export default function SupportPage() {
  return <SupportChatPage />;
}
