import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

type FooterText = {
  tagline: string;
  platform: string;
  wallet: string;
  security: string;
  securityCenter: string;
  riskDisclosure: string;
  support: string;
  supportLink: string;
  terms: string;
  privacy: string;
  rights: string;
};

const TEXT: Record<Locale, FooterText> = {
  ar: {
    tagline: "منصة نسخ التداول الذكية عبر 4 أسواق عالمية.",
    platform: "المنصة",
    wallet: "بوابة السحب والإيداع",
    security: "الأمان والشفافية",
    securityCenter: "مركز الأمان",
    riskDisclosure: "تحذير المخاطر",
    support: "الدعم والشروط",
    supportLink: "الدعم الفني",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    rights: "جميع الحقوق محفوظة.",
  },
  en: {
    tagline: "A smart copy trading platform across 4 global markets.",
    platform: "Platform",
    wallet: "Deposit & withdraw gateway",
    security: "Security & transparency",
    securityCenter: "Security center",
    riskDisclosure: "Risk disclosure",
    support: "Support & terms",
    supportLink: "Support",
    terms: "Terms & conditions",
    privacy: "Privacy policy",
    rights: "All rights reserved.",
  },
  fr: {
    tagline: "Une plateforme intelligente de copy trading sur 4 marchés mondiaux.",
    platform: "Plateforme",
    wallet: "Passerelle de dépôt et retrait",
    security: "Sécurité et transparence",
    securityCenter: "Centre de sécurité",
    riskDisclosure: "Avertissement sur les risques",
    support: "Support et conditions",
    supportLink: "Support",
    terms: "Conditions générales",
    privacy: "Politique de confidentialité",
    rights: "Tous droits réservés.",
  },
  es: {
    tagline: "Una plataforma inteligente de copy trading en 4 mercados globales.",
    platform: "Plataforma",
    wallet: "Pasarela de depósito y retiro",
    security: "Seguridad y transparencia",
    securityCenter: "Centro de seguridad",
    riskDisclosure: "Aviso de riesgo",
    support: "Soporte y términos",
    supportLink: "Soporte",
    terms: "Términos y condiciones",
    privacy: "Política de privacidad",
    rights: "Todos los derechos reservados.",
  },
  pt: {
    tagline: "Uma plataforma inteligente de copy trading em 4 mercados globais.",
    platform: "Plataforma",
    wallet: "Gateway de depósito e saque",
    security: "Segurança e transparência",
    securityCenter: "Central de segurança",
    riskDisclosure: "Aviso de risco",
    support: "Suporte e termos",
    supportLink: "Suporte",
    terms: "Termos e condições",
    privacy: "Política de privacidade",
    rights: "Todos os direitos reservados.",
  },
  zh: {
    tagline: "覆盖4大全球市场的智能跟单交易平台。",
    platform: "平台",
    wallet: "充值与提现网关",
    security: "安全与透明",
    securityCenter: "安全中心",
    riskDisclosure: "风险披露",
    support: "支持与条款",
    supportLink: "技术支持",
    terms: "条款与条件",
    privacy: "隐私政策",
    rights: "版权所有。",
  },
  hi: {
    tagline: "4 वैश्विक बाजारों में एक स्मार्ट कॉपी ट्रेडिंग प्लेटफ़ॉर्म।",
    platform: "प्लेटफ़ॉर्म",
    wallet: "जमा और निकासी गेटवे",
    security: "सुरक्षा और पारदर्शिता",
    securityCenter: "सुरक्षा केंद्र",
    riskDisclosure: "जोखिम प्रकटीकरण",
    support: "सहायता और शर्तें",
    supportLink: "सहायता",
    terms: "नियम और शर्तें",
    privacy: "गोपनीयता नीति",
    rights: "सर्वाधिकार सुरक्षित।",
  },
  ur: {
    tagline: "4 عالمی مارکیٹوں میں ایک ذہین کاپی ٹریڈنگ پلیٹ فارم۔",
    platform: "پلیٹ فارم",
    wallet: "جمع اور نکاسی گیٹ وے",
    security: "سیکیورٹی اور شفافیت",
    securityCenter: "سیکیورٹی سینٹر",
    riskDisclosure: "خطرے کا انکشاف",
    support: "سپورٹ اور شرائط",
    supportLink: "سپورٹ",
    terms: "شرائط و ضوابط",
    privacy: "رازداری کی پالیسی",
    rights: "جملہ حقوق محفوظ ہیں۔",
  },
  id: {
    tagline: "Platform copy trading cerdas di 4 pasar global.",
    platform: "Platform",
    wallet: "Gateway setor & tarik",
    security: "Keamanan & transparansi",
    securityCenter: "Pusat keamanan",
    riskDisclosure: "Pengungkapan risiko",
    support: "Dukungan & ketentuan",
    supportLink: "Dukungan",
    terms: "Syarat & ketentuan",
    privacy: "Kebijakan privasi",
    rights: "Seluruh hak dilindungi.",
  },
  vi: {
    tagline: "Nền tảng copy trading thông minh trên 4 thị trường toàn cầu.",
    platform: "Nền tảng",
    wallet: "Cổng nạp & rút tiền",
    security: "Bảo mật & minh bạch",
    securityCenter: "Trung tâm bảo mật",
    riskDisclosure: "Công bố rủi ro",
    support: "Hỗ trợ & điều khoản",
    supportLink: "Hỗ trợ",
    terms: "Điều khoản & điều kiện",
    privacy: "Chính sách bảo mật",
    rights: "Đã đăng ký bản quyền.",
  },
  th: {
    tagline: "แพลตฟอร์มคัดลอกการเทรดอัจฉริยะใน 4 ตลาดโลก",
    platform: "แพลตฟอร์ม",
    wallet: "เกตเวย์ฝากและถอน",
    security: "ความปลอดภัยและความโปร่งใส",
    securityCenter: "ศูนย์ความปลอดภัย",
    riskDisclosure: "การเปิดเผยความเสี่ยง",
    support: "การสนับสนุนและข้อกำหนด",
    supportLink: "ฝ่ายสนับสนุน",
    terms: "ข้อกำหนดและเงื่อนไข",
    privacy: "นโยบายความเป็นส่วนตัว",
    rights: "สงวนลิขสิทธิ์",
  },
  bn: {
    tagline: "৪টি বৈশ্বিক বাজারে একটি স্মার্ট কপি ট্রেডিং প্ল্যাটফর্ম।",
    platform: "প্ল্যাটফর্ম",
    wallet: "জমা ও উত্তোলন গেটওয়ে",
    security: "নিরাপত্তা ও স্বচ্ছতা",
    securityCenter: "নিরাপত্তা কেন্দ্র",
    riskDisclosure: "ঝুঁকি প্রকাশ",
    support: "সহায়তা ও শর্তাবলী",
    supportLink: "সহায়তা",
    terms: "শর্তাবলী",
    privacy: "গোপনীয়তা নীতি",
    rights: "সর্বস্বত্ব সংরক্ষিত।",
  },
  sw: {
    tagline: "Jukwaa la busara la biashara ya kunakili katika masoko 4 ya kimataifa.",
    platform: "Jukwaa",
    wallet: "Lango la kuweka na kutoa",
    security: "Usalama na uwazi",
    securityCenter: "Kituo cha usalama",
    riskDisclosure: "Ufichuzi wa hatari",
    support: "Msaada na masharti",
    supportLink: "Msaada",
    terms: "Masharti na vigezo",
    privacy: "Sera ya faragha",
    rights: "Haki zote zimehifadhiwa.",
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
              <Link href="/portfolio/deposit" className="line-clamp-1 text-muted hover:text-foreground">
                {t.wallet}
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
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-8 w-full max-w-5xl border-t border-glass-border pt-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Copy Matrix. {t.rights}
      </p>
    </footer>
  );
}
