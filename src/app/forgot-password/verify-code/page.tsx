import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { VerifyCodeForm } from "@/components/VerifyCodeForm";

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("verifyTitle")}</h1>

      <p className="text-sm text-muted">
        {t("verifyDesc", { emailPart: email ? ` (${email})` : "" })}
      </p>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <VerifyCodeForm email={email ?? ""} />

      <p className="text-sm text-muted">
        {t("noCodeReceived")}{" "}
        <Link href="/forgot-password" className="text-foreground underline">
          {t("requestNewCode")}
        </Link>
      </p>
    </main>
  );
}
