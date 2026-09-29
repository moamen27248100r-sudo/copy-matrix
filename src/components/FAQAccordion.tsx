import { isRtlLocale, type Locale } from "@/i18n/locales";

type FaqItem = { q: string; a: string };
type FaqText = { title: string; subtitle: string; items: FaqItem[] };

const TEXT: Record<Locale, FaqText> = {
  ar: {
    title: "الأسئلة الشائعة",
    subtitle: "كل ما تحتاج معرفته قبل أن تبدأ",
    items: [
      { q: "كيف يعمل النسخ؟", a: "تختار متداولًا وتحدد مبلغًا. عندما يفتح المتداول صفقة، تُفتح صفقة مماثلة في حسابك بحجم يتناسب مع المبلغ الذي خصصته." },
      { q: "هل يمكن أن أخسر أموالي؟", a: "نعم. التداول ينطوي على مخاطرة، وقد تخسر جزءًا من المبلغ المخصص أو كله. الأداء السابق لا يضمن النتائج المستقبلية. يتوقف النسخ تلقائيًا عند بلوغ الخسارة 50% من المبلغ المخصص." },
      { q: "ما الحد الأدنى؟", a: "يختلف من متداول إلى آخر، ويظهر الحد الأدنى الفعلي في ملف كل متداول قبل أن تنسخه." },
      { q: "ما الرسوم؟", a: "لا توجد رسوم اشتراك. قد يخصم المتداول نسبة من الأرباح فقط إذا حدّدها، وتظهر قبل بدء النسخ." },
      { q: "كيف أوقف النسخ؟", a: "افتح «نسخاتي» واضغط «إيقاف النسخ». يجب إغلاق الصفقات المفتوحة الخاصة بتلك النسخة أولًا." },
      { q: "كيف تختارون المتداولين؟", a: "يظهر المتداول في القائمة إذا كان حسابه نشطًا وغير موقوف، وله سجل صفقات حقيقي يمكنك مراجعته قبل النسخ." },
      { q: "كيف أسحب أموالي؟", a: "قدّم طلب سحب من صفحة المحفظة. يتطلب السحب توثيق الهوية، وتُراجَع الطلبات قبل تنفيذها." },
      { q: "هل يوجد حساب تجريبي؟", a: "نعم. يبدأ الحساب التجريبي برصيد افتراضي قدره 10,000$، ويتيح لك التدرّب دون المخاطرة بأموالك." },
    ],
  },
  en: {
    title: "Frequently asked questions",
    subtitle: "Everything you need to know before you start",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  fr: {
    title: "Questions fréquentes",
    subtitle: "Tout ce qu'il faut savoir avant de commencer",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  es: {
    title: "Preguntas frecuentes",
    subtitle: "Todo lo que necesitas saber antes de empezar",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  pt: {
    title: "Perguntas frequentes",
    subtitle: "Tudo o que você precisa saber antes de começar",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  zh: {
    title: "常见问题",
    subtitle: "开始之前您需要了解的一切",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  hi: {
    title: "अक्सर पूछे जाने वाले प्रश्न",
    subtitle: "शुरू करने से पहले आपको जो कुछ जानना चाहिए",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  ur: {
    title: "اکثر پوچھے گئے سوالات",
    subtitle: "شروع کرنے سے پہلے آپ کو جو کچھ جاننا چاہیے",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  id: {
    title: "Pertanyaan yang sering diajukan",
    subtitle: "Semua yang perlu Anda ketahui sebelum memulai",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  vi: {
    title: "Câu hỏi thường gặp",
    subtitle: "Mọi thứ bạn cần biết trước khi bắt đầu",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  th: {
    title: "คำถามที่พบบ่อย",
    subtitle: "ทุกสิ่งที่คุณต้องรู้ก่อนเริ่มต้น",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  bn: {
    title: "প্রায়শই জিজ্ঞাসিত প্রশ্ন",
    subtitle: "শুরু করার আগে আপনার যা জানা দরকার",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
  sw: {
    title: "Maswali yanayoulizwa mara kwa mara",
    subtitle: "Kila kitu unachohitaji kujua kabla ya kuanza",
    items: [
      { q: "How does copying work?", a: "You choose a trader and set an amount. When the trader opens a trade, a matching trade opens in your account, sized to the amount you allocated." },
      { q: "Can I lose my money?", a: "Yes. Trading involves risk and you may lose part or all of the amount you allocate. Past performance does not guarantee future results. Copying stops automatically when the loss reaches 50% of the allocated amount." },
      { q: "What is the minimum amount?", a: "It differs from trader to trader, and the actual minimum is shown on each trader's profile before you copy them." },
      { q: "What are the fees?", a: "There is no subscription fee. A trader may take a share of profits only if they set one, shown before you start copying." },
      { q: "How do I stop copying?", a: "Open “My copies” and press “Stop copying”. Open trades for that copy must be closed first." },
      { q: "How do you choose traders?", a: "A trader is listed when their account is active and not suspended, with a real trade history you can review before copying." },
      { q: "How do I withdraw my money?", a: "Submit a withdrawal request from the Wallet page. Withdrawals require identity verification and requests are reviewed before processing." },
      { q: "Is there a demo account?", a: "Yes. A demo account starts with $10,000 in virtual funds, letting you practice without risking your own money." },
    ],
  },
};

export function FAQAccordion({ locale }: { locale: Locale }) {
  const t = TEXT[locale] ?? TEXT.en;
  const isRtl = isRtlLocale(locale);

  return (
    <section id="faq" className="flex flex-col gap-8 border-t border-glass-border px-6 py-16">
      <div className="mx-auto flex flex-col items-center gap-2 text-center">
        <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="line-clamp-2 text-sm text-muted">{t.subtitle}</p>
      </div>
      <div className="mx-auto w-full max-w-3xl divide-y divide-glass-border overflow-hidden rounded-2xl border border-glass-border bg-glass-surface backdrop-blur-xl">
        {t.items.map((f) => (
          <details key={f.q} className="group open:bg-blue-500/[0.04]">
            <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:content-none sm:px-6 sm:py-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-sm font-bold text-blue-400">
                {isRtl ? "؟" : "?"}
              </span>
              <span className="line-clamp-1 flex-1 pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                {f.q}
              </span>
              <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-glass-border text-muted transition-all group-open:rotate-180 group-open:border-blue-500/30 group-open:bg-blue-500/10 group-open:text-blue-400">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </summary>
            <div className="flex gap-4 px-5 pb-6 sm:px-6">
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
              <p className="flex-1 border-t border-glass-border pt-4 text-base leading-8 text-foreground">
                {f.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
