import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { TradingViewChart } from "@/components/TradingViewChart";

export default async function MarketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">الأسواق</h1>
          <p className="mt-1 text-sm text-muted">تابع حركة الأسعار لحظة بلحظة، وغيّر الزوج من داخل الشارت.</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <TradingViewChart />
        </div>
      </main>
    </>
  );
}
