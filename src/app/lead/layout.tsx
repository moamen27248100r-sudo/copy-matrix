import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { LeadCenterNav } from "@/components/lead/LeadCenterNav";
import type { ReactNode } from "react";

// Every /lead/* page requires an approved lead trader account (Phase 1's
// profiles.is_lead_trader flag). Anyone else is sent to the application page.
export default async function LeadLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/lead"));

  const { data: profile } = await supabase.from("profiles").select("is_lead_trader").eq("id", user.id).single();
  if (!profile?.is_lead_trader) redirect("/become-lead-trader");

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <LeadCenterNav />
        {children}
      </main>
    </>
  );
}
