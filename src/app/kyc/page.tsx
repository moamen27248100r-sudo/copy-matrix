import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { submitKyc } from "@/app/kyc/actions";
import { AppNav } from "@/components/AppNav";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";
import { FlashMessage } from "@/components/ui/Toast";
import { DraftForm } from "@/components/ui/DraftForm";
import { FileInputButton } from "@/components/FileInputButton";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("kycTitle"), description: t("kycDesc") };
}

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Kyc");
  const fileTexts = { choose: t("chooseFile"), change: t("changeFile"), none: t("noFileChosen") };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fkyc");
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
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center gap-4 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>

        {/* 1 your details · 2 documents · 3 review (where the request is now). */}
        <ol className="flex items-center gap-2" aria-label={t("stepsTitle")}>
          {[t("flowStepDetails"), t("flowStepDocuments"), t("flowStepReview")].map((label, i) => {
            const current = submission ? (submission.status === "approved" ? 4 : 3) : 1;
            const done = i + 1 < current;
            const active = i + 1 === current;
            return (
              <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={active ? "step" : undefined}>
                <span className={`h-1.5 rounded-full ${done ? "bg-success" : active ? "bg-accent" : "bg-border"}`} />
                <span className={`truncate text-xs ${active ? "font-bold text-foreground" : "text-muted"}`}>
                  {i + 1}. {label}
                </span>
              </li>
            );
          })}
        </ol>

      {submission ? (
        <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
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

          <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-4 text-sm">
            <h2 className="font-bold">{t("acceptedTitle")}</h2>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-muted">
              <li>{t("acceptedId")}</li>
              <li>{t("acceptedAddress")}</li>
              <li>{t("acceptedFormats")}</li>
            </ul>
            <p className="text-xs text-muted">{t("whatNext")}</p>
          </section>

          {error && (
            <FlashMessage tone="error">
              {error}
            </FlashMessage>
          )}

          <DraftForm draftKey="kyc" action={submitKyc} className="flex flex-col gap-3">
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
            <FileInputButton name="idDocument" label={t("idDocumentLabel")} accept="image/*,.pdf" required texts={fileTexts} />
            <FileInputButton name="addressProof" label={t("addressProofLabel")} accept="image/*,.pdf" texts={fileTexts} />
            <button type="submit" className="rounded bg-accent px-3 py-2 font-medium text-accent-foreground transition hover:bg-accent-hover">
              {t("submitForReview")}
            </button>
          </DraftForm>
        </>
      )}
      </main>
    </>
  );
}
