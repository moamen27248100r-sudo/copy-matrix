import { getTranslations } from "next-intl/server";

export default async function CheckEmailPage() {
  const t = await getTranslations("Auth");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("checkEmailTitle")}</h1>
      <p className="text-sm text-muted">
        {t("checkEmailDesc")}
      </p>
    </main>
  );
}
