import { headers } from "next/headers";
import { AppNav } from "@/components/AppNav";
import { GuestHeader } from "@/components/GuestHeader";

// Header of the public information pages (terms, privacy, risk, about, security): the public header
// for a visitor, the signed-in header (without the sidebar) for a customer.
export async function LegalNav() {
  const authed = (await headers()).get("x-cm-authed") === "1";
  return authed ? <AppNav sidebar={false} /> : <GuestHeader />;
}
