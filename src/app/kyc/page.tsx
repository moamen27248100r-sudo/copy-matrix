import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { submitKyc } from "@/app/kyc/actions";
import { AppNav } from "@/components/AppNav";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Kyc");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: submission } = await supabase
    .from("kyc_submissions")
    .select("status, submitted_at, reviewed_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {submission ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">
            {t("statusLabel")}{" "}
            <span className="font-medium">
              {submission.status === "pending" && t("statusPending")}
              {submission.status === "approved" && t("statusApproved")}
              {submission.status === "rejected" && t("statusRejected")}
              {!["pending", "approved", "rejected"].includes(submission.status) && submission.status}
            </span>
          </p>
          <p className="text-xs text-muted">
            {t("submittedDate", { date: formatDate(submission.submitted_at, locale) })}
          </p>
          {submission.status === "pending" && (
            <p className="text-sm text-muted">
              {t("pendingNote")}
            </p>
          )}
          {submission.status === "rejected" && (
            <p className="text-sm text-danger">
              {t("rejectedNote")}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {t("intro")}
          </p>

          {error && (
            <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <form action={submitKyc} className="flex flex-col gap-3">
            <input
              name="fullName"
              type="text"
              placeholder={t("fullNamePlaceholder")}
              required
              className="rounded border border-border bg-surface px-3 py-2"
            />
            <input
              name="nationalIdNumber"
              type="text"
              placeholder={t("nationalIdPlaceholder")}
              required
              className="rounded border border-border bg-surface px-3 py-2"
            />
            <label className="flex flex-col gap-1 text-sm">
              {t("idDocumentLabel")}
              <input
                name="idDocument"
                type="file"
                accept="image/*,.pdf"
                required
                className="rounded border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("addressProofLabel")}
              <input
                name="addressProof"
                type="file"
                accept="image/*,.pdf"
                className="rounded border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className="rounded bg-accent px-3 py-2 font-medium text-accent-foreground transition hover:bg-accent-hover">
              {t("submitForReview")}
            </button>
          </form>
        </>
      )}
      </main>
    </>
  );
}
