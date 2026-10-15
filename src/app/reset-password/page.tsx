import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { FlashMessage } from "@/components/ui/Toast";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("resetPasswordTitle"), description: t("resetPasswordDesc") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-page-title">{t("resetTitle")}</h1>

      <p className="text-sm text-muted">{t("resetSubtitle")}</p>

      {error && (
        <FlashMessage tone="error">
          {error}
        </FlashMessage>
      )}

      <ResetPasswordForm />
    </main>
  );
}
