import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/locales";

type DemoBannerText = { badge: string; title: string; desc: string; cta: string };

const TEXT: Record<Locale, DemoBannerText> = {
  ar: {
    badge: "بدون مخاطرة",
    title: "جرّب النسخ الآن بحساب تجريبي آمن",
    desc: "رصيد افتراضي جاهز فوراً، بدون بطاقة، بدون التزام — جرّب المنصة كاملة بضغطة زر.",
    cta: "ابدأ الحساب التجريبي",
  },
  en: {
    badge: "Risk-free",
    title: "Try copy trading now with a safe demo account",
    desc: "A ready virtual balance, no card, no commitment — try the full platform in one click.",
    cta: "Start demo account",
  },
  fr: {
    badge: "Sans risque",
    title: "Essayez le copy trading dès maintenant avec un compte démo sécurisé",
    desc: "Un solde virtuel prêt immédiatement, sans carte, sans engagement — essayez toute la plateforme en un clic.",
    cta: "Démarrer le compte démo",
  },
  es: {
    badge: "Sin riesgo",
    title: "Prueba el copy trading ahora con una cuenta demo segura",
    desc: "Un saldo virtual listo al instante, sin tarjeta, sin compromiso — prueba toda la plataforma con un clic.",
    cta: "Iniciar cuenta demo",
  },
  pt: {
    badge: "Sem risco",
    title: "Experimente o copy trading agora com uma conta demo segura",
    desc: "Um saldo virtual pronto instantaneamente, sem cartão, sem compromisso — experimente a plataforma completa com um clique.",
    cta: "Iniciar conta demo",
  },
  zh: {
    badge: "无风险",
    title: "立即使用安全的模拟账户体验跟单交易",
    desc: "虚拟余额即刻可用，无需信用卡，无需承诺——一键体验完整平台。",
    cta: "开启模拟账户",
  },
  hi: {
    badge: "जोखिम-मुक्त",
    title: "अभी एक सुरक्षित डेमो खाते के साथ कॉपी ट्रेडिंग आज़माएं",
    desc: "तुरंत तैयार वर्चुअल बैलेंस, बिना कार्ड, बिना प्रतिबद्धता — एक क्लिक में पूरा प्लेटफ़ॉर्म आज़माएं।",
    cta: "डेमो खाता शुरू करें",
  },
  ur: {
    badge: "بلا خطرہ",
    title: "ابھی ایک محفوظ ڈیمو اکاؤنٹ کے ساتھ کاپی ٹریڈنگ آزمائیں",
    desc: "فوری طور پر تیار ورچوئل بیلنس، بغیر کارڈ، بغیر عزم — ایک کلک میں مکمل پلیٹ فارم آزمائیں۔",
    cta: "ڈیمو اکاؤنٹ شروع کریں",
  },
  id: {
    badge: "Bebas risiko",
    title: "Coba copy trading sekarang dengan akun demo yang aman",
    desc: "Saldo virtual siap instan, tanpa kartu, tanpa komitmen — coba seluruh platform dengan satu klik.",
    cta: "Mulai akun demo",
  },
  vi: {
    badge: "Không rủi ro",
    title: "Thử copy trading ngay với tài khoản demo an toàn",
    desc: "Số dư ảo sẵn sàng ngay lập tức, không cần thẻ, không cam kết — thử toàn bộ nền tảng chỉ với một cú nhấp.",
    cta: "Bắt đầu tài khoản demo",
  },
  th: {
    badge: "ปลอดความเสี่ยง",
    title: "ลองคัดลอกการเทรดตอนนี้ด้วยบัญชีทดลองที่ปลอดภัย",
    desc: "ยอดคงเหลือเสมือนจริงพร้อมใช้งานทันที ไม่ต้องใช้บัตร ไม่มีข้อผูกมัด — ลองใช้แพลตฟอร์มทั้งหมดในคลิกเดียว",
    cta: "เริ่มบัญชีทดลอง",
  },
  bn: {
    badge: "ঝুঁকিমুক্ত",
    title: "এখনই একটি নিরাপদ ডেমো অ্যাকাউন্ট দিয়ে কপি ট্রেডিং চেষ্টা করুন",
    desc: "তাৎক্ষণিক প্রস্তুত ভার্চুয়াল ব্যালেন্স, কোনো কার্ড ছাড়াই, কোনো অঙ্গীকার ছাড়াই — এক ক্লিকে পুরো প্ল্যাটফর্ম চেষ্টা করুন।",
    cta: "ডেমো অ্যাকাউন্ট শুরু করুন",
  },
  sw: {
    badge: "Bila hatari",
    title: "Jaribu biashara ya kunakili sasa na akaunti salama ya jaribio",
    desc: "Salio la kudhahania tayari papo hapo, bila kadi, bila ahadi — jaribu jukwaa lote kwa mbofyo mmoja.",
    cta: "Anza akaunti ya jaribio",
  },
};

export function DemoBanner({ locale }: { locale: Locale }) {
  const t = TEXT[locale] ?? TEXT.en;

  return (
    <section className="px-6 py-12">
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-4 overflow-hidden rounded-2xl border border-glass-border bg-glass-surface px-6 py-12 text-center backdrop-blur-xl">
        <span className="relative inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
          ✓ {t.badge}
        </span>
        <h2 className="relative line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="relative line-clamp-2 max-w-md text-sm text-muted">{t.desc}</p>
        <Button href="/signup" variant="primary" size="md" className="relative mt-2 px-8">
          {t.cta}
        </Button>
      </div>
    </section>
  );
}
