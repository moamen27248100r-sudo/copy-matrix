import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DepositGateway } from "@/components/DepositGateway";
import { SimpleDepositForm } from "@/components/SimpleDepositForm";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portfolioDepositTitle"), description: t("portfolioDepositDesc") };
}

export default async function DepositPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Portfolio");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fportfolio%2Fdeposit");

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
  const isDemo = profile?.account_type !== "real";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portfolio" aria-label={t("close")} className="text-muted transition hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">{t("depositTitle")}</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <p className="text-sm text-muted">{isDemo ? t("demoDepositNote") : t("reviewProcessingNote")}</p>

      {isDemo ? (
        // Demo funds need no network/address and are credited instantly.
        <SimpleDepositForm />
      ) : (
        <DepositGateway />
      )}
    </main>
  );
}
