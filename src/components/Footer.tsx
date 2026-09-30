import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AccountSecurity } from "@/components/AccountSecurity";
import type { Locale } from "@/i18n/locales";
import { PLATFORM_NAME, SUPPORT_EMAIL } from "@/config/platform";

type NavLink = { href: string; label: string };

type FooterText = {
  tagline: string;
  platform: string;
  about: string;
  security: string;
  securityCenter: string;
  riskDisclosure: string;
  support: string;
  supportLink: string;
  terms: string;
  privacy: string;
  rights: string;
  riskDisclaimer: string;
};

const TEXT: Record<Locale, FooterText> = {
  ar: {
    tagline: "منصة عالمية لنسخ صفقات المتداولين عبر 4 أسواق.",
    platform: "المنصة",
    about: "من نحن",
    security: "الأمان والشفافية",
    securityCenter: "مركز الأمان",
    riskDisclosure: "تحذير المخاطر",
    support: "الدعم والشروط",
    supportLink: "الدعم الفني",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    rights: "جميع الحقوق محفوظة.",
    riskDisclaimer:
      "Copy Matrix منصة برمجية لنسخ إشارات التداول وليست مؤسسة مالية أو بنكاً أو وسيط تداول مرخّصاً. التداول ونسخ الصفقات ينطويان على مخاطرة عالية قد تؤدي إلى خسارة كامل رأس المال المستثمر، والأداء السابق لا يضمن نتائج مستقبلية.",
  },
  en: {
    tagline: "A global platform for copying traders' trades across 4 markets.",
    platform: "Platform",
    about: "About us",
    security: "Security & transparency",
    securityCenter: "Security center",
    riskDisclosure: "Risk disclosure",
    support: "Support & terms",
    supportLink: "Support",
    terms: "Terms & conditions",
    privacy: "Privacy policy",
    rights: "All rights reserved.",
    riskDisclaimer:
      "Copy Matrix is a software platform for copying trading signals — it is not a financial institution, a bank, or a licensed brokerage. Trading and copy trading carry a high level of risk and may result in the loss of your entire invested capital; past performance does not guarantee future results.",
  },
  fr: {
    tagline: "Une plateforme intelligente de copy trading sur 4 marchés mondiaux.",
    platform: "Plateforme",
    about: "À propos",
    security: "Sécurité et transparence",
    securityCenter: "Centre de sécurité",
    riskDisclosure: "Avertissement sur les risques",
    support: "Support et conditions",
    supportLink: "Support",
    terms: "Conditions générales",
    privacy: "Politique de confidentialité",
    rights: "Tous droits réservés.",
    riskDisclaimer:
      "Copy Matrix est une plateforme logicielle de copie de signaux de trading — ce n'est ni un établissement financier, ni une banque, ni un courtier agréé. Le trading et le copy trading comportent un niveau de risque élevé pouvant entraîner la perte totale du capital investi ; les performances passées ne garantissent pas les résultats futurs.",
  },
  es: {
    tagline: "Una plataforma inteligente de copy trading en 4 mercados globales.",
    platform: "Plataforma",
    about: "Quiénes somos",
    security: "Seguridad y transparencia",
    securityCenter: "Centro de seguridad",
    riskDisclosure: "Aviso de riesgo",
    support: "Soporte y términos",
    supportLink: "Soporte",
    terms: "Términos y condiciones",
    privacy: "Política de privacidad",
    rights: "Todos los derechos reservados.",
    riskDisclaimer:
      "Copy Matrix es una plataforma de software para copiar señales de trading; no es una institución financiera, un banco ni una correduría con licencia. Operar y copiar operaciones conlleva un alto nivel de riesgo y puede resultar en la pérdida total del capital invertido; el rendimiento pasado no garantiza resultados futuros.",
  },
  pt: {
    tagline: "Uma plataforma inteligente de copy trading em 4 mercados globais.",
    platform: "Plataforma",
    about: "Sobre nós",
    security: "Segurança e transparência",
    securityCenter: "Central de segurança",
    riskDisclosure: "Aviso de risco",
    support: "Suporte e termos",
    supportLink: "Suporte",
    terms: "Termos e condições",
    privacy: "Política de privacidade",
    rights: "Todos os direitos reservados.",
    riskDisclaimer:
      "Copy Matrix é uma plataforma de software para copiar sinais de negociação — não é uma instituição financeira, banco ou corretora licenciada. Negociar e copiar operações envolve alto risco e pode resultar na perda total do capital investido; desempenho passado não garante resultados futuros.",
  },
  zh: {
    tagline: "覆盖4大全球市场的智能跟单交易平台。",
    platform: "平台",
    about: "关于我们",
    security: "安全与透明",
    securityCenter: "安全中心",
    riskDisclosure: "风险披露",
    support: "支持与条款",
    supportLink: "技术支持",
    terms: "条款与条件",
    privacy: "隐私政策",
    rights: "版权所有。",
    riskDisclaimer: "Copy Matrix 是一个用于复制交易信号的软件平台，并非金融机构、银行或持牌经纪商。交易和跟单交易涉及高风险，可能导致投资本金全部损失；过往表现不保证未来结果。",
  },
  hi: {
    tagline: "4 वैश्विक बाजारों में एक स्मार्ट कॉपी ट्रेडिंग प्लेटफ़ॉर्म।",
    platform: "प्लेटफ़ॉर्म",
    about: "हमारे बारे में",
    security: "सुरक्षा और पारदर्शिता",
    securityCenter: "सुरक्षा केंद्र",
    riskDisclosure: "जोखिम प्रकटीकरण",
    support: "सहायता और शर्तें",
    supportLink: "सहायता",
    terms: "नियम और शर्तें",
    privacy: "गोपनीयता नीति",
    rights: "सर्वाधिकार सुरक्षित।",
    riskDisclaimer:
      "Copy Matrix ट्रेडिंग सिग्नल कॉपी करने के लिए एक सॉफ़्टवेयर प्लेटफ़ॉर्म है — यह कोई वित्तीय संस्था, बैंक या लाइसेंस प्राप्त ब्रोकरेज नहीं है। ट्रेडिंग और कॉपी ट्रेडिंग में उच्च जोखिम शामिल है और इससे निवेशित पूंजी का पूर्ण नुकसान हो सकता है; पिछला प्रदर्शन भविष्य के परिणामों की गारंटी नहीं देता।",
  },
  ur: {
    tagline: "4 عالمی مارکیٹوں میں ایک ذہین کاپی ٹریڈنگ پلیٹ فارم۔",
    platform: "پلیٹ فارم",
    about: "ہمارے بارے میں",
    security: "سیکیورٹی اور شفافیت",
    securityCenter: "سیکیورٹی سینٹر",
    riskDisclosure: "خطرے کا انکشاف",
    support: "سپورٹ اور شرائط",
    supportLink: "سپورٹ",
    terms: "شرائط و ضوابط",
    privacy: "رازداری کی پالیسی",
    rights: "جملہ حقوق محفوظ ہیں۔",
    riskDisclaimer:
      "Copy Matrix ٹریڈنگ سگنلز کاپی کرنے کے لیے ایک سافٹ ویئر پلیٹ فارم ہے — یہ کوئی مالیاتی ادارہ، بینک یا لائسنس یافتہ بروکریج نہیں ہے۔ ٹریڈنگ اور کاپی ٹریڈنگ میں زیادہ خطرہ شامل ہے اور اس سے سرمایہ کاری شدہ رقم کا مکمل نقصان ہو سکتا ہے؛ ماضی کی کارکردگی مستقبل کے نتائج کی ضمانت نہیں دیتی۔",
  },
  id: {
    tagline: "Platform copy trading cerdas di 4 pasar global.",
    platform: "Platform",
    about: "Tentang kami",
    security: "Keamanan & transparansi",
    securityCenter: "Pusat keamanan",
    riskDisclosure: "Pengungkapan risiko",
    support: "Dukungan & ketentuan",
    supportLink: "Dukungan",
    terms: "Syarat & ketentuan",
    privacy: "Kebijakan privasi",
    rights: "Seluruh hak dilindungi.",
    riskDisclaimer:
      "Copy Matrix adalah platform perangkat lunak untuk menyalin sinyal trading — bukan lembaga keuangan, bank, atau pialang berlisensi. Trading dan copy trading mengandung risiko tinggi dan dapat mengakibatkan kerugian total modal yang diinvestasikan; kinerja masa lalu tidak menjamin hasil di masa depan.",
  },
  vi: {
    tagline: "Nền tảng copy trading thông minh trên 4 thị trường toàn cầu.",
    platform: "Nền tảng",
    about: "Giới thiệu",
    security: "Bảo mật & minh bạch",
    securityCenter: "Trung tâm bảo mật",
    riskDisclosure: "Công bố rủi ro",
    support: "Hỗ trợ & điều khoản",
    supportLink: "Hỗ trợ",
    terms: "Điều khoản & điều kiện",
    privacy: "Chính sách bảo mật",
    rights: "Đã đăng ký bản quyền.",
    riskDisclaimer:
      "Copy Matrix là nền tảng phần mềm để sao chép tín hiệu giao dịch — không phải là tổ chức tài chính, ngân hàng hay công ty môi giới được cấp phép. Giao dịch và sao chép giao dịch tiềm ẩn rủi ro cao và có thể dẫn đến mất toàn bộ vốn đầu tư; hiệu suất trong quá khứ không đảm bảo kết quả trong tương lai.",
  },
  th: {
    tagline: "แพลตฟอร์มคัดลอกการเทรดอัจฉริยะใน 4 ตลาดโลก",
    platform: "แพลตฟอร์ม",
    about: "เกี่ยวกับเรา",
    security: "ความปลอดภัยและความโปร่งใส",
    securityCenter: "ศูนย์ความปลอดภัย",
    riskDisclosure: "การเปิดเผยความเสี่ยง",
    support: "การสนับสนุนและข้อกำหนด",
    supportLink: "ฝ่ายสนับสนุน",
    terms: "ข้อกำหนดและเงื่อนไข",
    privacy: "นโยบายความเป็นส่วนตัว",
    rights: "สงวนลิขสิทธิ์",
    riskDisclaimer:
      "Copy Matrix เป็นแพลตฟอร์มซอฟต์แวร์สำหรับคัดลอกสัญญาณการเทรด ไม่ใช่สถาบันการเงิน ธนาคาร หรือโบรกเกอร์ที่ได้รับใบอนุญาต การเทรดและการคัดลอกการเทรดมีความเสี่ยงสูงและอาจทำให้สูญเสียเงินลงทุนทั้งหมด ผลการดำเนินงานในอดีตไม่รับประกันผลลัพธ์ในอนาคต",
  },
  bn: {
    tagline: "৪টি বৈশ্বিক বাজারে একটি স্মার্ট কপি ট্রেডিং প্ল্যাটফর্ম।",
    platform: "প্ল্যাটফর্ম",
    about: "আমাদের সম্পর্কে",
    security: "নিরাপত্তা ও স্বচ্ছতা",
    securityCenter: "নিরাপত্তা কেন্দ্র",
    riskDisclosure: "ঝুঁকি প্রকাশ",
    support: "সহায়তা ও শর্তাবলী",
    supportLink: "সহায়তা",
    terms: "শর্তাবলী",
    privacy: "গোপনীয়তা নীতি",
    rights: "সর্বস্বত্ব সংরক্ষিত।",
    riskDisclaimer:
      "Copy Matrix ট্রেডিং সিগন্যাল কপি করার জন্য একটি সফটওয়্যার প্ল্যাটফর্ম — এটি কোনো আর্থিক প্রতিষ্ঠান, ব্যাংক বা লাইসেন্সপ্রাপ্ত ব্রোকারেজ নয়। ট্রেডিং এবং কপি ট্রেডিং উচ্চ ঝুঁকি বহন করে এবং বিনিয়োগকৃত মূলধনের সম্পূর্ণ ক্ষতি হতে পারে; অতীতের পারফরম্যান্স ভবিষ্যতের ফলাফলের নিশ্চয়তা দেয় না।",
  },
  sw: {
    tagline: "Jukwaa la busara la biashara ya kunakili katika masoko 4 ya kimataifa.",
    platform: "Jukwaa",
    about: "Kuhusu sisi",
    security: "Usalama na uwazi",
    securityCenter: "Kituo cha usalama",
    riskDisclosure: "Ufichuzi wa hatari",
    support: "Msaada na masharti",
    supportLink: "Msaada",
    terms: "Masharti na vigezo",
    privacy: "Sera ya faragha",
    rights: "Haki zote zimehifadhiwa.",
    riskDisclaimer:
      "Copy Matrix ni jukwaa la programu kwa ajili ya kunakili ishara za biashara — si taasisi ya kifedha, benki, au wakala wa udalali wenye leseni. Biashara na kunakili biashara hubeba hatari kubwa na inaweza kusababisha hasara kamili ya mtaji uliowekezwa; utendaji wa zamani hauhakikishi matokeo ya baadaye.",
  },
};

export function Footer({ locale, dir, navLinks }: { locale: Locale; dir: "rtl" | "ltr"; navLinks: NavLink[] }) {
  const t = TEXT[locale] ?? TEXT.en;

  return (
    <footer dir={dir} className="border-t border-glass-border px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Logo iconClassName="h-5 w-5" textClassName="text-lg" />
          <p className="line-clamp-2 max-w-xs text-sm text-muted">{t.tagline}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t.platform}</p>
            <div className="flex flex-col gap-2 text-sm">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="line-clamp-1 text-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
              <Link href="/about" className="line-clamp-1 text-muted hover:text-foreground">
                {t.about}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t.security}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/security" className="line-clamp-1 text-muted hover:text-foreground">
                {t.securityCenter}
              </Link>
              <Link href="/risk-disclosure" className="line-clamp-1 text-muted hover:text-foreground">
                {t.riskDisclosure}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t.support}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/support" className="line-clamp-1 text-muted hover:text-foreground">
                {t.supportLink}
              </Link>
              <Link href="/legal/terms" className="line-clamp-1 text-muted hover:text-foreground">
                {t.terms}
              </Link>
              <Link href="/legal/privacy" className="line-clamp-1 text-muted hover:text-foreground">
                {t.privacy}
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="line-clamp-1 text-start text-muted hover:text-foreground">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <AccountSecurity locale={locale} />
      </div>

      <div className="mx-auto mt-8 w-full max-w-5xl border-t border-glass-border pt-6 text-center">
        <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-muted/80">{t.riskDisclaimer}</p>
        <p className="mt-3 text-xs text-muted">
          © {new Date().getFullYear()} {PLATFORM_NAME}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
