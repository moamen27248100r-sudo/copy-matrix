import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { GLOBAL_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";

// Wraps a route whose client components read namespaces that are not shipped everywhere
// (see i18n/client-messages.ts): the global set plus the route's own.
export async function ExtraMessages({ namespaces, children }: { namespaces: readonly string[]; children: React.ReactNode }) {
  const messages = pickMessages(await getMessages(), [...GLOBAL_CLIENT_NAMESPACES, ...namespaces]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
