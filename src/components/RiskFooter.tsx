import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Quiet risk reminder at the end of the financial pages: a thin rule, grey small text, and the link
// to the full disclosure. On a demo account it also says the money and the trades are simulated.
export async function RiskFooter({ demo = false }: { demo?: boolean }) {
  const t = await getTranslations("RiskFooter");
  return (
    <footer className="mt-2 border-t border-border/60 pt-4 text-center text-xs leading-relaxed text-muted">
      <p>{t("text")}</p>
      {demo && <p className="mt-1">{t("demoNote")}</p>}
      <Link href="/risk-disclosure" className="mt-1 inline-block underline underline-offset-2 transition hover:text-foreground">
        {t("readFull")}
      </Link>
    </footer>
  );
}
