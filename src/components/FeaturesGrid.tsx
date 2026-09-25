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

const MARKET_ICONS: { symbol: string; glyph: string }[] = [
  { symbol: "BTC", glyph: "₿" },
  { symbol: "EUR/USD", glyph: "€$" },
  { symbol: "GOLD", glyph: "Au" },
  { symbol: "US100", glyph: "📈" },
];

const CARD_BASE =
  "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0d1424]/90 p-6 shadow-2xl backdrop-blur-xl transition hover:border-neon-cyan/40";

export function FeaturesGrid({ locale }: { locale: Locale }) {
  const t = TEXT[locale] ?? TEXT.en;

  return (
    <section className="px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="mx-auto flex flex-col items-center gap-1.5 text-center">
          <h2 className="line-clamp-1 text-2xl font-bold text-white sm:text-3xl">{t.title}</h2>
          <p className="line-clamp-2 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-neon-cyan/20 blur-3xl transition group-hover:bg-neon-cyan/30"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-neon-cyan shadow-[0_0_12px_-2px_rgba(34,211,238,0.6)]">
                ⚡ {t.card1.badge}
              </span>
              <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card1.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-400">{t.card1.desc}</p>
            </div>
            <div className="relative mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-neon-cyan to-neon-emerald shadow-[0_0_10px_0_rgba(34,211,238,0.8)]" />
            </div>
          </div>

          {/* Card 2 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-neon-cyan/15 blur-3xl transition group-hover:bg-neon-cyan/25"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card2.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-400">{t.card2.desc}</p>
            </div>
            <div className="relative mt-4 grid grid-cols-4 gap-2">
              {MARKET_ICONS.map((m) => (
                <div
                  key={m.symbol}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-[#131c31]/80 py-2.5 text-slate-200 backdrop-blur-sm"
                >
                  <span className="text-sm font-semibold text-neon-cyan">{m.glyph}</span>
                  <span className="line-clamp-1 text-[10px] text-slate-400">{m.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-neon-emerald/15 blur-3xl transition group-hover:bg-neon-emerald/25"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <h3 className="line-clamp-1 text-lg font-bold text-white">{t.card3.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-400">{t.card3.desc}</p>
            </div>
            <div className="relative mt-4 rounded-xl border border-white/5 bg-[#131c31]/80 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="line-clamp-1">{t.card3.riskLabel}</span>
                <span className="line-clamp-1 font-semibold text-neon-emerald">{t.card3.riskValue}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-neon-emerald to-neon-cyan shadow-[0_0_10px_0_rgba(16,185,129,0.7)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
