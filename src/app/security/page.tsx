import { getLocale } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    title: "الأمان والشفافية",
    intro: "أمان بيانات وأموال مستخدمينا هو أساس تصميم Copy Matrix، من التشفير إلى شفافية كل صفقة تُنفَّذ.",
    sections: [
      {
        title: "تشفير 256-Bit SSL/TLS",
        body: "جميع الاتصالات بين متصفحك وخوادم المنصة مشفّرة بمعيار TLS بطول مفتاح 256-بت، بما يحمي بيانات تسجيل الدخول وتفاصيل المحفظة من الاعتراض.",
      },
      {
        title: "شفافية السجلات",
        body: "كل صفقة منسوخة وكل عملية إيداع أو سحب تُسجَّل ويمكن للمستخدم مراجعتها كاملة من سجل الصفقات وسجل المحفظة في أي وقت.",
      },
      {
        title: "حساب تجريبي (Demo)",
        body: "يمكنك تجربة نسخ الصفقات ورؤية آلية عمل المنصة بالكامل عبر حساب تجريبي برصيد افتراضي، دون أي مخاطرة على أموالك الحقيقية.",
      },
    ],
  },
  en: {
    title: "Security & Transparency",
    intro: "Protecting our users' data and funds is central to how Copy Matrix is built — from encryption to full transparency on every executed trade.",
    sections: [
      {
        title: "256-Bit SSL/TLS encryption",
        body: "All traffic between your browser and our servers is encrypted with 256-bit TLS, protecting login credentials and wallet details from interception.",
      },
      {
        title: "Transparent records",
        body: "Every copied trade and every deposit or withdrawal is logged and fully reviewable by the user at any time from the trade history and wallet records.",
      },
      {
        title: "Demo account",
        body: "Try copy trading and see exactly how the platform works with a risk-free demo account and a virtual balance — no real funds at risk.",
      },
    ],
  },
} as const;

export function generateMetadata() {
  return { title: "Copy Matrix — Security" };
}

export default async function SecurityPage() {
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
