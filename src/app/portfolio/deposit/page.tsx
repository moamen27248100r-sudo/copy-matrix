import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DepositGateway } from "@/components/DepositGateway";
import { SimpleDepositForm } from "@/components/SimpleDepositForm";

export default async function DepositPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
  const isDemo = profile?.account_type !== "real";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portfolio" aria-label="إغلاق" className="text-muted transition hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">الإيداع</h1>

      {isDemo ? (
        // Demo money doesn't need a real network/address — one field, one
        // tap, credited instantly, same simplification already made for
        // demo withdrawals.
        <SimpleDepositForm />
      ) : (
        <DepositGateway />
      )}
    </main>
  );
}
