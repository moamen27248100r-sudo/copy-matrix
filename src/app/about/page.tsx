import Link from "next/link";
import { getLocale } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { SUPPORT_EMAIL } from "@/config/platform";

type Section = { title: string; body: string };
type AboutText = {
  title: string;
  intro: string;
  sections: Section[];
  riskLink: string;
  contactTitle: string;
  contactBody: string;
};

const TEXT: Partial<Record<Locale, AboutText>> & { en: AboutText } = {
  ar: {
    title: "من نحن",
    intro: "Copy Matrix منصة عالمية لنسخ صفقات المتداولين عبر 4 أسواق: العملات الرقمية والفوركس والذهب والمؤشرات.",
    sections: [
      {
        title: "رؤيتنا",
        body: "نؤمن بأن نسخ التداول يجب أن يكون واضحًا لكل شخص: أداء موثّق يمكن مراجعته، ومخاطرة معلنة، وتحكّم كامل بيدك. هدفنا أن تختار من تثق به لنسخ صفقاته بناءً على سجل أدائه الفعلي، لا على الوعود.",
      },
      {
        title: "كيف تعمل المنصة",
        body: "تسجّل ببريدك الإلكتروني وتبدأ بحساب تجريبي مجاني، ثم تقارن أداء المتداولين ومخاطرتهم وتختار متداولًا وتحدد المبلغ الذي تريد نسخه به. تُنسخ صفقات المتداول في حسابك تلقائيًا بحجم يتناسب مع هذا المبلغ، ويمكنك إيقاف النسخ فورًا في أي وقت.",
      },
      {
        title: "التزامنا بالشفافية",
        body: "كل متداول له سجل صفقات يمكن مراجعته قبل النسخ، ولا توجد رسوم اشتراك أو عمولات خفية. تُراجَع طلبات السحب قبل تنفيذها، ولكل نسخة حد خسارة تلقائي يوقفها عند بلوغه.",
      },
      {
        title: "تحذير المخاطر",
        body: "Copy Matrix منصة برمجية لنسخ إشارات التداول، وليست مؤسسة مالية أو بنكًا أو وسيط تداول مرخّصًا. التداول ونسخ الصفقات ينطويان على مخاطرة عالية قد تؤدي إلى خسارة جزء من رأس المال أو كله، والأداء السابق لا يضمن نتائج مستقبلية.",
      },
    ],
    riskLink: "اقرأ تحذير المخاطر كاملًا",
    contactTitle: "تواصل معنا",
    contactBody: "لأي سؤال أو استفسار، راسلنا على",
  },
  en: {
    title: "About us",
    intro: "Copy Matrix is a global platform for copying traders' trades across 4 markets: crypto, forex, gold and indices.",
    sections: [
      {
        title: "Our vision",
        body: "We believe copy trading should be clear to everyone: verifiable performance, disclosed risk, and full control in your hands. Our goal is to help you pick who to copy based on a real track record, not promises.",
      },
      {
        title: "How the platform works",
        body: "You sign up with your email and start with a free demo account, then compare traders' performance and risk, choose a trader and set the amount you want to copy them with. The trader's trades are copied to your account automatically, sized in proportion to that amount, and you can stop copying instantly at any time.",
      },
      {
        title: "Our commitment to transparency",
        body: "Every trader has a trade history you can review before copying, and there are no subscription fees or hidden commissions. Withdrawal requests are reviewed before they are processed, and every copy has an automatic loss limit that stops it once reached.",
      },
      {
        title: "Risk warning",
        body: "Copy Matrix is a software platform for copying trading signals — not a financial institution, a bank, or a licensed brokerage. Trading and copy trading carry a high level of risk and may result in the loss of part or all of your capital; past performance does not guarantee future results.",
      },
    ],
    riskLink: "Read the full risk disclosure",
    contactTitle: "Contact us",
    contactBody: "For any question, write to us at",
  },
};

// TODO(owner): add the legal company details (registered name, registration
// number, registered address, regulatory status) once they are available.

export function generateMetadata() {
  return { title: "Copy Matrix — About us" };
}

export default async function AboutPage() {
  const locale = (await getLocale()) as Locale;
  const t = TEXT[locale] ?? TEXT.en;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <>
      <LegalNav />
      <main dir={dir} className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm leading-relaxed text-muted">{t.intro}</p>
        </div>

        <div className="flex flex-col gap-5">
          {t.sections.map((s) => (
            <section
              key={s.title}
              className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl"
            >
              <h2 className="font-medium">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
          <Link href="/risk-disclosure" className="text-sm text-accent hover:underline">
            {t.riskLink}
          </Link>

          <section className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <h2 className="font-medium">{t.contactTitle}</h2>
            <p className="text-sm leading-relaxed text-muted">
              {t.contactBody}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="text-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
