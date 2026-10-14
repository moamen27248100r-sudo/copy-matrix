import { getTranslations } from "next-intl/server";
import { AuthSteps } from "@/components/auth/AuthSteps";
import { safeNextPath } from "@/lib/safe-next";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("signupCheckEmailTitle"), description: t("signupCheckEmailDesc") };
}

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const t = await getTranslations("Auth");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-3 p-6 text-center">
      <AuthSteps step={2} backHref={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} />
      <h1 className="text-2xl font-semibold">{t("checkEmailTitle")}</h1>
      <p className="text-sm text-muted">
        {t("checkEmailDesc")}
      </p>
    </main>
  );
}
