import { getLocale } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    title: "تحذير المخاطر",
    intro: "Copy Matrix هي منصة برمجية (Software Platform) لتنفيذ ونسخ إشارات التداول، وليست مؤسسة مالية أو بنكاً أو وسيط تداول مرخّصاً.",
    sections: [
      {
        title: "طبيعة المنصة",
        body: "توفر المنصة أدوات برمجية لعرض أداء القادة ونسخ صفقاتهم آلياً. جميع الأرصدة والصفقات المعروضة تعكس نشاطاً تعاقدياً بين المستخدم والمنصة، ولا تمثل ضماناً بعائد مستقبلي.",
      },
      {
        title: "السحب والإيداع",
        body: "تتم عمليات الإيداع والسحب حصراً عبر بوابة الكريبتو المتاحة في صفحة المحفظة. المستخدم مسؤول عن التحقق من صحة عنوان المحفظة والشبكة المستخدمة قبل تأكيد أي عملية.",
      },
      {
        title: "فك الارتباط الفوري",
        body: "يمكن لأي مستخدم إيقاف نسخ أي قائد فوراً بضغطة زر (One-Click Unfollow) من صفحة المحفظة، مع توقف تنفيذ أي صفقات جديدة لذلك القائد فور الفك.",
      },
      {
        title: "تحذير تنظيمي",
        body: "التداول ونسخ الصفقات ينطويان على مخاطرة عالية وقد يؤدي إلى خسارة كامل رأس المال المستثمر. لا تُعد هذه الصفحة استشارة مالية أو قانونية، ويجب على كل مستخدم تقييم وضعه المالي وقوانين بلده قبل استخدام المنصة.",
      },
    ],
  },
  en: {
    title: "Risk Disclosure",
    intro: "Copy Matrix is a software platform for executing and copying trading signals — it is not a financial institution, a bank, or a licensed brokerage.",
    sections: [
      {
        title: "Nature of the platform",
        body: "The platform provides software tools to display leader performance and automatically copy their trades. Balances and trades shown reflect a contractual relationship between the user and the platform, and are not a guarantee of future returns.",
      },
      {
        title: "Deposits & withdrawals",
        body: "Deposits and withdrawals are processed exclusively through the crypto gateway available on the portfolio page. Users are responsible for verifying the wallet address and network before confirming any transaction.",
      },
      {
        title: "Instant unfollow",
        body: "Any user can stop copying a leader instantly with one click (One-Click Unfollow) from the portfolio page; no new trades are copied from that leader once unfollowed.",
      },
      {
        title: "Regulatory warning",
        body: "Trading and copy trading carry a high level of risk and may result in the loss of the entire invested capital. This page is not financial or legal advice — every user should assess their own financial situation and local laws before using the platform.",
      },
    ],
  },
} as const;

export function generateMetadata() {
  return { title: "Copy Matrix — Risk Disclosure" };
}

export default async function RiskDisclosurePage() {
  const locale = (await getLocale()) as Locale;
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;
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
              className="flex flex-col gap-2 rounded-2xl border border-cyan-500/15 bg-slate-900/40 p-5 backdrop-blur-xl"
            >
              <h2 className="font-medium">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
