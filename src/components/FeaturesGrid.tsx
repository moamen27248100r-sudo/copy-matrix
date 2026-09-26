import type { ReactNode } from "react";
import type { Locale } from "@/i18n/locales";

type FeaturesText = {
  title: string;
  subtitle: string;
  card1: { badge: string; title: string; desc: string };
  card2: { title: string; desc: string };
  card3: { title: string; desc: string; riskLabel: string; riskValue: string };
};

const TEXT: Record<Locale, FeaturesText> = {
  ar: {
    title: "لماذا Copy Matrix",
    subtitle: "شبكة قوة كاملة لنسخ التداول بثقة",
    card1: { badge: "لحظي", title: "تنفيذ لحظي بـ 0% عمولة خفية", desc: "أوامر تُنفَّذ في نفس اللحظة بدون أي رسوم مخفية على الصفقات." },
    card2: { title: "تغطية كاملة لـ 4 أسواق عالمية", desc: "تداول العملات الرقمية والفوركس والذهب والمؤشرات من حساب واحد." },
    card3: { title: "تحكم ذكي ومؤشرات موثوقة", desc: "مؤشر مخاطرة حي يوضح مستوى التعرض لكل قائد تنسخه.", riskLabel: "مستوى المخاطرة", riskValue: "منخفض" },
  },
  en: {
    title: "Why Copy Matrix",
    subtitle: "A full power grid for copy trading with confidence",
    card1: { badge: "Instant", title: "Instant execution, 0% hidden commission", desc: "Orders fill the moment they're placed, with no hidden trade fees." },
    card2: { title: "Full coverage across 4 global markets", desc: "Trade crypto, forex, gold and indices from a single account." },
    card3: { title: "Smart control, trusted indicators", desc: "A live risk gauge shows your exposure to every leader you copy.", riskLabel: "Risk level", riskValue: "Low" },
  },
  fr: {
    title: "Pourquoi Copy Matrix",
    subtitle: "Une grille de puissance complète pour trader en copie en toute confiance",
    card1: { badge: "Instantané", title: "Exécution instantanée, 0 % de commission cachée", desc: "Les ordres sont exécutés à l'instant, sans aucun frais caché sur les trades." },
    card2: { title: "Couverture complète sur 4 marchés mondiaux", desc: "Tradez crypto, forex, or et indices depuis un seul compte." },
    card3: { title: "Contrôle intelligent, indicateurs fiables", desc: "Une jauge de risque en direct affiche votre exposition à chaque leader copié.", riskLabel: "Niveau de risque", riskValue: "Faible" },
  },
  es: {
    title: "Por qué Copy Matrix",
    subtitle: "Una red de potencia completa para copiar operaciones con confianza",
    card1: { badge: "Instantáneo", title: "Ejecución instantánea, 0% de comisión oculta", desc: "Las órdenes se ejecutan al instante, sin comisiones ocultas en las operaciones." },
    card2: { title: "Cobertura completa en 4 mercados globales", desc: "Opera cripto, forex, oro e índices desde una sola cuenta." },
    card3: { title: "Control inteligente, indicadores confiables", desc: "Un indicador de riesgo en vivo muestra tu exposición a cada líder que copias.", riskLabel: "Nivel de riesgo", riskValue: "Bajo" },
  },
  pt: {
    title: "Por que Copy Matrix",
    subtitle: "Uma grade de poder completa para copy trading com confiança",
    card1: { badge: "Instantâneo", title: "Execução instantânea, 0% de comissão oculta", desc: "As ordens são executadas no mesmo instante, sem taxas ocultas nas operações." },
    card2: { title: "Cobertura completa em 4 mercados globais", desc: "Negocie cripto, forex, ouro e índices a partir de uma única conta." },
    card3: { title: "Controle inteligente, indicadores confiáveis", desc: "Um medidor de risco ao vivo mostra sua exposição a cada líder copiado.", riskLabel: "Nível de risco", riskValue: "Baixo" },
  },
  zh: {
    title: "为什么选择 Copy Matrix",
    subtitle: "一个完整的动力网格，助您放心跟单交易",
    card1: { badge: "即时", title: "即时执行，0% 隐藏手续费", desc: "订单即刻成交，交易不收取任何隐藏费用。" },
    card2: { title: "全面覆盖4大全球市场", desc: "在同一账户中交易加密货币、外汇、黄金和指数。" },
    card3: { title: "智能控制，可信指标", desc: "实时风险仪表显示您对每位跟单领导者的敞口。", riskLabel: "风险等级", riskValue: "低" },
  },
  hi: {
    title: "Copy Matrix क्यों",
    subtitle: "आत्मविश्वास के साथ कॉपी ट्रेडिंग के लिए एक पूर्ण पावर ग्रिड",
    card1: { badge: "तुरंत", title: "तुरंत निष्पादन, 0% छिपा हुआ कमीशन", desc: "ऑर्डर उसी क्षण निष्पादित होते हैं, ट्रेड पर कोई छिपा शुल्क नहीं।" },
    card2: { title: "4 वैश्विक बाजारों में पूर्ण कवरेज", desc: "एक ही खाते से क्रिप्टो, फॉरेक्स, सोना और इंडेक्स ट्रेड करें।" },
    card3: { title: "स्मार्ट नियंत्रण, भरोसेमंद संकेतक", desc: "एक लाइव रिस्क गेज हर लीडर के प्रति आपके एक्सपोज़र को दिखाता है।", riskLabel: "जोखिम स्तर", riskValue: "कम" },
  },
  ur: {
    title: "Copy Matrix کیوں",
    subtitle: "اعتماد کے ساتھ کاپی ٹریڈنگ کے لیے ایک مکمل پاور گرڈ",
    card1: { badge: "فوری", title: "فوری عملدرآمد، 0% پوشیدہ کمیشن", desc: "آرڈرز اسی لمحے مکمل ہوتے ہیں، بغیر کسی پوشیدہ فیس کے۔" },
    card2: { title: "4 عالمی مارکیٹوں میں مکمل رسائی", desc: "ایک ہی اکاؤنٹ سے کرپٹو، فاریکس، سونا اور انڈیکس ٹریڈ کریں۔" },
    card3: { title: "ذہین کنٹرول، قابل اعتماد اشارے", desc: "لائیو رسک گیج ہر لیڈر کے ساتھ آپ کی نمائش دکھاتا ہے۔", riskLabel: "خطرے کی سطح", riskValue: "کم" },
  },
  id: {
    title: "Mengapa Copy Matrix",
    subtitle: "Grid daya lengkap untuk copy trading dengan percaya diri",
    card1: { badge: "Instan", title: "Eksekusi instan, 0% komisi tersembunyi", desc: "Order dieksekusi seketika, tanpa biaya tersembunyi pada setiap transaksi." },
    card2: { title: "Cakupan penuh di 4 pasar global", desc: "Trading kripto, forex, emas, dan indeks dari satu akun." },
    card3: { title: "Kontrol cerdas, indikator terpercaya", desc: "Pengukur risiko langsung menunjukkan eksposur Anda ke setiap leader yang diikuti.", riskLabel: "Tingkat risiko", riskValue: "Rendah" },
  },
  vi: {
    title: "Tại sao chọn Copy Matrix",
    subtitle: "Một lưới sức mạnh toàn diện để sao chép giao dịch một cách tự tin",
    card1: { badge: "Tức thì", title: "Thực thi tức thì, 0% hoa hồng ẩn", desc: "Lệnh được khớp ngay lập tức, không có bất kỳ phí ẩn nào trên giao dịch." },
    card2: { title: "Bao phủ đầy đủ 4 thị trường toàn cầu", desc: "Giao dịch tiền điện tử, forex, vàng và chỉ số chỉ từ một tài khoản." },
    card3: { title: "Kiểm soát thông minh, chỉ báo đáng tin cậy", desc: "Đồng hồ đo rủi ro trực tiếp cho thấy mức độ tiếp xúc của bạn với mỗi leader được sao chép.", riskLabel: "Mức độ rủi ro", riskValue: "Thấp" },
  },
  th: {
    title: "ทำไมต้อง Copy Matrix",
    subtitle: "กริดพลังครบวงจรเพื่อการคัดลอกการเทรดอย่างมั่นใจ",
    card1: { badge: "ทันที", title: "การดำเนินการทันที ค่าคอมมิชชันแอบแฝง 0%", desc: "คำสั่งถูกดำเนินการทันที โดยไม่มีค่าธรรมเนียมแอบแฝงใด ๆ" },
    card2: { title: "ครอบคลุมเต็มรูปแบบใน 4 ตลาดโลก", desc: "เทรดคริปโต ฟอเร็กซ์ ทองคำ และดัชนี จากบัญชีเดียว" },
    card3: { title: "การควบคุมอัจฉริยะ ตัวชี้วัดที่เชื่อถือได้", desc: "มาตรวัดความเสี่ยงแบบเรียลไทม์แสดงการเปิดรับความเสี่ยงต่อผู้นำแต่ละคนที่คุณคัดลอก", riskLabel: "ระดับความเสี่ยง", riskValue: "ต่ำ" },
  },
  bn: {
    title: "কেন Copy Matrix",
    subtitle: "আত্মবিশ্বাসের সাথে কপি ট্রেডিংয়ের জন্য একটি সম্পূর্ণ পাওয়ার গ্রিড",
    card1: { badge: "তাৎক্ষণিক", title: "তাৎক্ষণিক এক্সিকিউশন, ০% গোপন কমিশন", desc: "অর্ডার সাথে সাথে কার্যকর হয়, কোনো গোপন ফি ছাড়াই।" },
    card2: { title: "৪টি বৈশ্বিক বাজারে সম্পূর্ণ কভারেজ", desc: "একটি একাউন্ট থেকে ক্রিপ্টো, ফরেক্স, স্বর্ণ এবং ইনডেক্স ট্রেড করুন।" },
    card3: { title: "স্মার্ট নিয়ন্ত্রণ, নির্ভরযোগ্য সূচক", desc: "একটি লাইভ রিস্ক গেজ প্রতিটি লিডারের প্রতি আপনার ঝুঁকি দেখায়।", riskLabel: "ঝুঁকির স্তর", riskValue: "কম" },
  },
  sw: {
    title: "Kwa nini Copy Matrix",
    subtitle: "Gridi kamili ya nguvu kwa biashara ya kunakili kwa kujiamini",
    card1: { badge: "Papo hapo", title: "Utekelezaji wa papo hapo, kamisheni fiche 0%", desc: "Maagizo yanatekelezwa papo hapo, bila ada yoyote iliyofichwa kwenye biashara." },
    card2: { title: "Ufikiaji kamili wa masoko 4 ya kimataifa", desc: "Fanya biashara ya crypto, forex, dhahabu na fahirisi kutoka akaunti moja." },
    card3: { title: "Udhibiti wa busara, viashiria vya kuaminika", desc: "Kipimo cha hatari cha moja kwa moja kinaonyesha mfiduo wako kwa kila kiongozi unayenakili.", riskLabel: "Kiwango cha hatari", riskValue: "Chini" },
  },
};

const MARKETS: { symbol: string; glyph: string; colorClass: string }[] = [
  { symbol: "BTC", glyph: "₿", colorClass: "text-orange-400" },
  { symbol: "EUR/USD", glyph: "€$", colorClass: "text-blue-400" },
  { symbol: "GOLD", glyph: "Au", colorClass: "text-amber-400" },
  { symbol: "US100", glyph: "📈", colorClass: "text-emerald-400" },
];

function CardIcon({ name, className }: { name: "zap" | "globe" | "settings"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const ICON_BADGE_CLASSES: Record<"zap" | "globe" | "settings", string> = {
  // Amber for instant execution (speed), blue for markets (standard
  // financial blue), neutral slate for settings/control — no cyan/teal
  // anywhere, each icon uses the color its meaning actually calls for.
  zap: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  globe: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  settings: "text-slate-300 bg-slate-800/80 border-slate-700/50",
};

function IconBadge({ name }: { name: "zap" | "globe" | "settings" }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${ICON_BADGE_CLASSES[name]}`}>
      <CardIcon name={name} className="h-4 w-4" />
    </span>
  );
}

export function FeaturesGrid({ locale }: { locale: Locale }) {
  const t = TEXT[locale] ?? TEXT.en;

  return (
    <section className="bg-transparent px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="mx-auto flex flex-col items-center gap-1.5 text-center">
          <h2 className="line-clamp-1 text-2xl font-bold text-white sm:text-3xl">{t.title}</h2>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-400">{t.subtitle}</p>
        </div>

        {/* No cards, no fills — features are separated by a hairline and
            generous spacing so the section reads as one open surface. */}
        <div className="flex flex-col divide-y divide-slate-800/50">
          {/* Feature 1: instant execution */}
          <div className="flex flex-col gap-3 py-8 first:pt-0">
            <IconBadge name="zap" />
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card1.title}</h3>
              <span className="text-xs font-medium text-slate-400">· {t.card1.badge}</span>
            </div>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t.card1.desc}</p>
          </div>

          {/* Feature 2: markets, as inline badges instead of boxed tiles */}
          <div className="flex flex-col gap-3 py-8">
            <IconBadge name="globe" />
            <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card2.title}</h3>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t.card2.desc}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
              {MARKETS.map((m) => (
                <div key={m.symbol} className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-xs font-bold ${m.colorClass}`}>
                    {m.glyph}
                  </span>
                  <span className="text-sm text-slate-300">{m.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature 3: smart control & risk gauge */}
          <div className="flex flex-col gap-3 py-8 last:pb-0">
            <IconBadge name="settings" />
            <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card3.title}</h3>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t.card3.desc}</p>
            <div className="mt-1 flex max-w-xs items-center justify-between text-xs text-slate-400">
              <span>{t.card3.riskLabel}</span>
              <span className="font-semibold text-slate-300">{t.card3.riskValue}</span>
            </div>
            <div className="h-1 max-w-xs overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/4 rounded-full bg-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
