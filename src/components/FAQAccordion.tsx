import { isRtlLocale, type Locale } from "@/i18n/locales";

type FaqItem = { q: string; a: string };
type FaqText = { title: string; subtitle: string; items: FaqItem[] };

const TEXT: Record<Locale, FaqText> = {
  ar: {
    title: "الأسئلة الشائعة",
    subtitle: "كل ما تحتاج معرفته قبل أن تبدأ",
    items: [
      { q: "كيف يعمل نسخ الصفقات؟", a: "تختار قائداً وتخصص له جزءاً من رصيدك، وكل صفقة يفتحها تُنسخ لحظياً في حسابك بنفس النسبة." },
      { q: "كيف أسحب أو أودع أموالي؟", a: "الإيداع والسحب يتمّان عبر بوابة الكريبتو مباشرة من صفحة المحفظة، بشكل آمن وسريع." },
      { q: "هل أتحكم برصيدي أثناء النسخ؟", a: "نعم، يمكنك تعديل رأس المال المخصص أو إيقاف النسخ أو فك الارتباط بضغطة زر في أي وقت." },
      { q: "هل يوجد حساب تجريبي؟", a: "نعم، يمكنك تجربة المنصة بالكامل عبر حساب تجريبي برصيد افتراضي بدون أي مخاطرة." },
    ],
  },
  en: {
    title: "Frequently asked questions",
    subtitle: "Everything you need to know before you start",
    items: [
      { q: "How does copy trading work?", a: "You pick a leader and allocate part of your balance to them; every trade they open is copied to your account at the same ratio instantly." },
      { q: "How do I withdraw or deposit?", a: "Deposits and withdrawals go through the crypto gateway directly from your portfolio page, quickly and securely." },
      { q: "Can I control my balance while copying?", a: "Yes — adjust your allocated capital, pause copying, or unfollow instantly with one click, anytime." },
      { q: "Is there a demo account?", a: "Yes, you can try the full platform with a risk-free demo account and virtual balance." },
    ],
  },
  fr: {
    title: "Questions fréquentes",
    subtitle: "Tout ce qu'il faut savoir avant de commencer",
    items: [
      { q: "Comment fonctionne le copy trading ?", a: "Vous choisissez un leader et lui allouez une partie de votre solde ; chaque trade qu'il ouvre est copié instantanément sur votre compte dans la même proportion." },
      { q: "Comment retirer ou déposer des fonds ?", a: "Les dépôts et retraits se font directement via la passerelle crypto depuis la page portefeuille, rapidement et en toute sécurité." },
      { q: "Puis-je contrôler mon solde pendant la copie ?", a: "Oui — ajustez votre capital alloué, mettez en pause la copie ou désabonnez-vous instantanément en un clic, à tout moment." },
      { q: "Existe-t-il un compte de démonstration ?", a: "Oui, vous pouvez essayer la plateforme complète avec un compte démo sans risque et un solde virtuel." },
    ],
  },
  es: {
    title: "Preguntas frecuentes",
    subtitle: "Todo lo que necesitas saber antes de empezar",
    items: [
      { q: "¿Cómo funciona el copy trading?", a: "Eliges un líder y le asignas parte de tu saldo; cada operación que abre se copia al instante en tu cuenta con la misma proporción." },
      { q: "¿Cómo retiro o deposito fondos?", a: "Los depósitos y retiros se realizan directamente a través de la pasarela cripto desde tu página de portafolio, de forma rápida y segura." },
      { q: "¿Puedo controlar mi saldo mientras copio?", a: "Sí: ajusta tu capital asignado, pausa la copia o deja de seguir al instante con un clic, en cualquier momento." },
      { q: "¿Existe una cuenta demo?", a: "Sí, puedes probar la plataforma completa con una cuenta demo sin riesgo y saldo virtual." },
    ],
  },
  pt: {
    title: "Perguntas frequentes",
    subtitle: "Tudo o que você precisa saber antes de começar",
    items: [
      { q: "Como funciona o copy trading?", a: "Você escolhe um líder e aloca parte do seu saldo a ele; cada operação que ele abre é copiada instantaneamente na sua conta na mesma proporção." },
      { q: "Como faço para sacar ou depositar?", a: "Depósitos e saques são feitos diretamente pelo gateway de cripto na página de carteira, de forma rápida e segura." },
      { q: "Posso controlar meu saldo durante a cópia?", a: "Sim — ajuste seu capital alocado, pause a cópia ou deixe de seguir instantaneamente com um clique, a qualquer momento." },
      { q: "Existe uma conta demo?", a: "Sim, você pode testar a plataforma completa com uma conta demo sem risco e saldo virtual." },
    ],
  },
  zh: {
    title: "常见问题",
    subtitle: "开始之前您需要了解的一切",
    items: [
      { q: "跟单交易是如何运作的？", a: "您选择一位领导者并为其分配部分余额；他们开立的每笔交易都会按相同比例即时复制到您的账户。" },
      { q: "如何提现或充值？", a: "充值和提现直接通过投资组合页面上的加密网关进行，快速且安全。" },
      { q: "跟单期间我能控制自己的余额吗？", a: "可以——您可以随时调整分配资金、暂停跟单，或一键立即取消关注。" },
      { q: "是否有模拟账户？", a: "有，您可以使用无风险的模拟账户和虚拟余额体验完整平台。" },
    ],
  },
  hi: {
    title: "अक्सर पूछे जाने वाले प्रश्न",
    subtitle: "शुरू करने से पहले आपको जो कुछ जानना चाहिए",
    items: [
      { q: "कॉपी ट्रेडिंग कैसे काम करती है?", a: "आप एक लीडर चुनते हैं और अपने बैलेंस का एक हिस्सा उसे आवंटित करते हैं; वह जो भी ट्रेड खोलता है वह तुरंत उसी अनुपात में आपके खाते में कॉपी हो जाता है।" },
      { q: "मैं पैसे कैसे निकालूं या जमा करूं?", a: "जमा और निकासी सीधे पोर्टफोलियो पेज पर क्रिप्टो गेटवे के माध्यम से जल्दी और सुरक्षित रूप से होती है।" },
      { q: "क्या कॉपी करते समय मैं अपना बैलेंस नियंत्रित कर सकता हूं?", a: "हां — कभी भी अपनी आवंटित पूंजी समायोजित करें, कॉपी रोकें, या एक क्लिक में तुरंत अनफॉलो करें।" },
      { q: "क्या डेमो खाता उपलब्ध है?", a: "हां, आप जोखिम-मुक्त डेमो खाते और वर्चुअल बैलेंस के साथ पूरा प्लेटफ़ॉर्म आज़मा सकते हैं।" },
    ],
  },
  ur: {
    title: "اکثر پوچھے گئے سوالات",
    subtitle: "شروع کرنے سے پہلے آپ کو جو کچھ جاننا چاہیے",
    items: [
      { q: "کاپی ٹریڈنگ کیسے کام کرتی ہے؟", a: "آپ ایک لیڈر منتخب کرتے ہیں اور اپنے بیلنس کا کچھ حصہ اسے مختص کرتے ہیں؛ وہ جو بھی ٹریڈ کھولتا ہے وہ فوری طور پر اسی تناسب سے آپ کے اکاؤنٹ میں کاپی ہو جاتا ہے۔" },
      { q: "میں رقم کیسے نکالوں یا جمع کروں؟", a: "جمع اور نکاسی براہ راست پورٹ فولیو پیج پر کرپٹو گیٹ وے کے ذریعے تیزی اور محفوظ طریقے سے ہوتی ہے۔" },
      { q: "کیا میں کاپی کرتے ہوئے اپنا بیلنس کنٹرول کر سکتا ہوں؟", a: "جی ہاں — کسی بھی وقت اپنا مختص سرمایہ ایڈجسٹ کریں، کاپی روکیں، یا ایک کلک میں فوری طور پر ان فالو کریں۔" },
      { q: "کیا ڈیمو اکاؤنٹ دستیاب ہے؟", a: "جی ہاں، آپ بغیر کسی خطرے کے ڈیمو اکاؤنٹ اور ورچوئل بیلنس کے ساتھ مکمل پلیٹ فارم آزما سکتے ہیں۔" },
    ],
  },
  id: {
    title: "Pertanyaan yang sering diajukan",
    subtitle: "Semua yang perlu Anda ketahui sebelum memulai",
    items: [
      { q: "Bagaimana cara kerja copy trading?", a: "Anda memilih leader dan mengalokasikan sebagian saldo Anda kepadanya; setiap transaksi yang dibuka disalin secara instan ke akun Anda dengan rasio yang sama." },
      { q: "Bagaimana cara menarik atau menyetor dana?", a: "Setor dan tarik dana langsung melalui gateway kripto dari halaman portofolio Anda, cepat dan aman." },
      { q: "Bisakah saya mengontrol saldo saat menyalin?", a: "Ya — sesuaikan modal yang dialokasikan, jeda penyalinan, atau berhenti mengikuti secara instan dengan satu klik, kapan saja." },
      { q: "Apakah ada akun demo?", a: "Ya, Anda dapat mencoba platform lengkap dengan akun demo bebas risiko dan saldo virtual." },
    ],
  },
  vi: {
    title: "Câu hỏi thường gặp",
    subtitle: "Mọi thứ bạn cần biết trước khi bắt đầu",
    items: [
      { q: "Sao chép giao dịch hoạt động như thế nào?", a: "Bạn chọn một leader và phân bổ một phần số dư của mình cho họ; mỗi giao dịch họ mở sẽ được sao chép ngay lập tức vào tài khoản của bạn theo cùng tỷ lệ." },
      { q: "Làm thế nào để rút hoặc nạp tiền?", a: "Nạp và rút tiền được thực hiện trực tiếp qua cổng crypto từ trang danh mục đầu tư của bạn, nhanh chóng và an toàn." },
      { q: "Tôi có thể kiểm soát số dư của mình trong khi sao chép không?", a: "Có — điều chỉnh vốn được phân bổ, tạm dừng sao chép hoặc hủy theo dõi ngay lập tức chỉ với một cú nhấp chuột, bất cứ lúc nào." },
      { q: "Có tài khoản demo không?", a: "Có, bạn có thể dùng thử toàn bộ nền tảng với tài khoản demo không rủi ro và số dư ảo." },
    ],
  },
  th: {
    title: "คำถามที่พบบ่อย",
    subtitle: "ทุกสิ่งที่คุณต้องรู้ก่อนเริ่มต้น",
    items: [
      { q: "การคัดลอกการเทรดทำงานอย่างไร", a: "คุณเลือกผู้นำและจัดสรรยอดคงเหลือส่วนหนึ่งให้พวกเขา ทุกการเทรดที่พวกเขาเปิดจะถูกคัดลอกไปยังบัญชีของคุณทันทีในอัตราส่วนเดียวกัน" },
      { q: "ฉันจะถอนหรือฝากเงินได้อย่างไร", a: "การฝากและถอนทำผ่านเกตเวย์คริปโตโดยตรงจากหน้าพอร์ตโฟลิโอของคุณ รวดเร็วและปลอดภัย" },
      { q: "ฉันสามารถควบคุมยอดคงเหลือของตัวเองขณะคัดลอกได้หรือไม่", a: "ได้ — ปรับเงินทุนที่จัดสรร หยุดการคัดลอกชั่วคราว หรือเลิกติดตามได้ทันทีด้วยการคลิกเดียว ได้ตลอดเวลา" },
      { q: "มีบัญชีทดลองหรือไม่", a: "มี คุณสามารถทดลองใช้แพลตฟอร์มแบบเต็มรูปแบบด้วยบัญชีทดลองที่ปลอดความเสี่ยงและยอดคงเหลือเสมือนจริง" },
    ],
  },
  bn: {
    title: "প্রায়শই জিজ্ঞাসিত প্রশ্ন",
    subtitle: "শুরু করার আগে আপনার যা জানা দরকার",
    items: [
      { q: "কপি ট্রেডিং কীভাবে কাজ করে?", a: "আপনি একজন লিডার বেছে নেন এবং আপনার ব্যালেন্সের একটি অংশ তাকে বরাদ্দ করেন; তিনি যে কোনো ট্রেড খুললে তা একই অনুপাতে তাৎক্ষণিকভাবে আপনার অ্যাকাউন্টে কপি হয়ে যায়।" },
      { q: "আমি কীভাবে টাকা তুলব বা জমা দেব?", a: "জমা এবং উত্তোলন সরাসরি আপনার পোর্টফোলিও পেজের ক্রিপ্টো গেটওয়ের মাধ্যমে দ্রুত এবং নিরাপদে হয়।" },
      { q: "কপি করার সময় আমি কি আমার ব্যালেন্স নিয়ন্ত্রণ করতে পারি?", a: "হ্যাঁ — যেকোনো সময় আপনার বরাদ্দকৃত মূলধন সমন্বয় করুন, কপি বন্ধ করুন, বা এক ক্লিকে তাৎক্ষণিক আনফলো করুন।" },
      { q: "কোনো ডেমো অ্যাকাউন্ট আছে কি?", a: "হ্যাঁ, আপনি ঝুঁকিমুক্ত ডেমো অ্যাকাউন্ট এবং ভার্চুয়াল ব্যালেন্স দিয়ে সম্পূর্ণ প্ল্যাটফর্ম চেষ্টা করতে পারেন।" },
    ],
  },
  sw: {
    title: "Maswali yanayoulizwa mara kwa mara",
    subtitle: "Kila kitu unachohitaji kujua kabla ya kuanza",
    items: [
      { q: "Biashara ya kunakili inafanyaje kazi?", a: "Unachagua kiongozi na kumtengea sehemu ya salio lako; kila biashara anayofungua inanakiliwa papo hapo kwenye akaunti yako kwa uwiano sawa." },
      { q: "Ninawezaje kutoa au kuweka fedha?", a: "Uwekaji na utoaji hufanyika moja kwa moja kupitia lango la crypto kutoka ukurasa wako wa portfolio, kwa haraka na kwa usalama." },
      { q: "Je, ninaweza kudhibiti salio langu wakati wa kunakili?", a: "Ndiyo — rekebisha mtaji wako uliotengwa, sitisha kunakili, au acha kufuata papo hapo kwa mbofyo mmoja, wakati wowote." },
      { q: "Je, kuna akaunti ya jaribio?", a: "Ndiyo, unaweza kujaribu jukwaa kamili na akaunti ya jaribio isiyo na hatari na salio la kudhahania." },
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
