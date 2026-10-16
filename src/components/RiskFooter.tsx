import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Quiet risk reminder at the end of the financial pages: a thin rule and one short grey line with
// the link to the full disclosure.
export async function RiskFooter() {
  const t = await getTranslations("RiskFooter");
  return (
    <footer className="mt-2 border-t border-border/60 pt-4 text-center text-xs leading-relaxed text-muted">
      <p>
        {t("text")}{" "}
        <Link href="/risk-disclosure" className="underline underline-offset-2 transition hover:text-foreground">
          {t("readFull")}
        </Link>
      </p>
    </footer>
  );
}
