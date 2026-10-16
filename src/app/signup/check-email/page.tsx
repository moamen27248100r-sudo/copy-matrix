import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("signupCheckEmailTitle"), description: t("signupCheckEmailDesc") };
}

// Only reached if the project is switched to "confirm the address before the first sign-in".
export default async function CheckEmailPage() {
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("checkEmailTitle")} subtitle={t("checkEmailDesc")}>
      <span />
    </AuthShell>
  );
}
