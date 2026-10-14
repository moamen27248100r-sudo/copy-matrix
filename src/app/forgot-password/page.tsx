import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { FlashMessage } from "@/components/ui/Toast";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("forgotPasswordTitle"), description: t("forgotPasswordDesc") };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("forgotTitle")}</h1>

      <p className="text-sm text-muted">
        {t("forgotSubtitle")}
      </p>

      {error && (
        <FlashMessage tone="error">
          {error}
        </FlashMessage>
      )}

      <ForgotPasswordForm />

      <p className="text-sm text-muted">
        {t("rememberedPassword")}{" "}
        <Link href="/login" className="text-foreground underline">
          {t("loginButton")}
        </Link>
      </p>
    </main>
  );
}
