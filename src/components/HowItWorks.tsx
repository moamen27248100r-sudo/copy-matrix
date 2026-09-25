import type { Locale } from "@/i18n/locales";

type Step = { icon: string; title: string; desc: string };
type HowItWorksText = { badge: string; title: string; subtitle: string; steps: Step[] };

const TEXT: Record<Locale, HowItWorksText> = {
  ar: {
    badge: "آلية العمل",
    title: "أربع خطوات لتبدأ النسخ",
    subtitle: "مسار واحد متصل من التسجيل إلى التنفيذ اللحظي",
    steps: [
      { icon: "🛡️", title: "ربط الحساب وإدارة المحفظة", desc: "أنشئ حسابك واربط محفظتك بأمان في دقائق." },
      { icon: "💰", title: "تخصيص ورأس المال المرن", desc: "حدد رأس المال المخصص لكل قائد تنسخه بحرية." },
      { icon: "📊", title: "تحليل وتصفية قادة Matrix", desc: "قارن الأداء والمخاطرة واختر القادة الأنسب لك." },
      { icon: "⚡", title: "التنفيذ اللحظي والتحكم التلقائي", desc: "صفقاتك تُنسخ لحظياً مع تحكم كامل بالإيقاف والفك." },
    ],
  },
  en: {
    badge: "How it works",
    title: "Four steps to start copying",
    subtitle: "One connected path from sign-up to instant execution",
    steps: [
      { icon: "🛡️", title: "Connect your account & wallet", desc: "Create your account and link your wallet securely in minutes." },
      { icon: "💰", title: "Flexible allocation & capital", desc: "Choose how much capital to allocate to each leader you copy." },
      { icon: "📊", title: "Analyze & filter Matrix leaders", desc: "Compare performance and risk to pick the leaders that fit you." },
      { icon: "⚡", title: "Instant execution & auto control", desc: "Trades copy instantly, with full control to pause or unfollow." },
    ],
  },
  fr: {
    badge: "Comment ça marche",
    title: "Quatre étapes pour commencer à copier",
    subtitle: "Un seul parcours connecté, de l'inscription à l'exécution instantanée",
    steps: [
      { icon: "🛡️", title: "Connectez votre compte et votre portefeuille", desc: "Créez votre compte et liez votre portefeuille en toute sécurité en quelques minutes." },
      { icon: "💰", title: "Allocation et capital flexibles", desc: "Choisissez le capital à allouer à chaque leader que vous copiez." },
      { icon: "📊", title: "Analysez et filtrez les leaders Matrix", desc: "Comparez performance et risque pour choisir les leaders qui vous conviennent." },
      { icon: "⚡", title: "Exécution instantanée et contrôle automatique", desc: "Les trades sont copiés instantanément, avec un contrôle total pour suspendre ou vous désabonner." },
    ],
  },
  es: {
    badge: "Cómo funciona",
    title: "Cuatro pasos para empezar a copiar",
    subtitle: "Un solo camino conectado, desde el registro hasta la ejecución instantánea",
    steps: [
      { icon: "🛡️", title: "Conecta tu cuenta y billetera", desc: "Crea tu cuenta y vincula tu billetera de forma segura en minutos." },
      { icon: "💰", title: "Asignación y capital flexibles", desc: "Elige cuánto capital asignar a cada líder que copias." },
      { icon: "📊", title: "Analiza y filtra líderes de Matrix", desc: "Compara rendimiento y riesgo para elegir los líderes que más te convienen." },
      { icon: "⚡", title: "Ejecución instantánea y control automático", desc: "Las operaciones se copian al instante, con control total para pausar o dejar de seguir." },
    ],
  },
  pt: {
    badge: "Como funciona",
    title: "Quatro passos para começar a copiar",
    subtitle: "Um único caminho conectado, do cadastro à execução instantânea",
    steps: [
      { icon: "🛡️", title: "Conecte sua conta e carteira", desc: "Crie sua conta e vincule sua carteira com segurança em minutos." },
      { icon: "💰", title: "Alocação e capital flexíveis", desc: "Escolha quanto capital alocar para cada líder que você copia." },
      { icon: "📊", title: "Analise e filtre líderes Matrix", desc: "Compare desempenho e risco para escolher os líderes certos para você." },
      { icon: "⚡", title: "Execução instantânea e controle automático", desc: "As operações são copiadas instantaneamente, com controle total para pausar ou deixar de seguir." },
    ],
  },
  zh: {
    badge: "工作原理",
    title: "四步开始跟单",
    subtitle: "从注册到即时执行的一条完整路径",
    steps: [
      { icon: "🛡️", title: "连接账户与钱包", desc: "几分钟内安全创建账户并绑定钱包。" },
      { icon: "💰", title: "灵活的资金分配", desc: "自由选择为每位跟单领导者分配的资金。" },
      { icon: "📊", title: "分析并筛选 Matrix 领导者", desc: "比较业绩与风险，挑选最适合您的领导者。" },
      { icon: "⚡", title: "即时执行与自动控制", desc: "交易即时复制，并可完全控制暂停或取消关注。" },
    ],
  },
  hi: {
    badge: "यह कैसे काम करता है",
    title: "कॉपी शुरू करने के लिए चार चरण",
    subtitle: "साइन-अप से लेकर तुरंत निष्पादन तक एक जुड़ा हुआ रास्ता",
    steps: [
      { icon: "🛡️", title: "खाता और वॉलेट कनेक्ट करें", desc: "मिनटों में सुरक्षित रूप से खाता बनाएं और वॉलेट लिंक करें।" },
      { icon: "💰", title: "लचीला आवंटन और पूंजी", desc: "हर लीडर के लिए आवंटित पूंजी स्वतंत्र रूप से चुनें।" },
      { icon: "📊", title: "Matrix लीडर्स का विश्लेषण और फ़िल्टर करें", desc: "प्रदर्शन और जोखिम की तुलना करें और सही लीडर चुनें।" },
      { icon: "⚡", title: "तुरंत निष्पादन और स्वचालित नियंत्रण", desc: "ट्रेड तुरंत कॉपी होते हैं, रोकने या अनफॉलो करने पर पूर्ण नियंत्रण के साथ।" },
    ],
  },
  ur: {
    badge: "یہ کیسے کام کرتا ہے",
    title: "کاپی شروع کرنے کے لیے چار مراحل",
    subtitle: "سائن اپ سے لے کر فوری عملدرآمد تک ایک منسلک راستہ",
    steps: [
      { icon: "🛡️", title: "اکاؤنٹ اور والیٹ منسلک کریں", desc: "منٹوں میں محفوظ طریقے سے اکاؤنٹ بنائیں اور والیٹ منسلک کریں۔" },
      { icon: "💰", title: "لچکدار مختص اور سرمایہ", desc: "ہر لیڈر کے لیے مختص سرمایہ آزادانہ طور پر منتخب کریں۔" },
      { icon: "📊", title: "Matrix لیڈرز کا تجزیہ اور فلٹر", desc: "کارکردگی اور خطرے کا موازنہ کر کے موزوں ترین لیڈرز منتخب کریں۔" },
      { icon: "⚡", title: "فوری عملدرآمد اور خودکار کنٹرول", desc: "ٹریڈز فوری طور پر کاپی ہوتے ہیں، روکنے یا ان فالو کرنے پر مکمل کنٹرول کے ساتھ۔" },
    ],
  },
  id: {
    badge: "Cara kerja",
    title: "Empat langkah untuk mulai menyalin",
    subtitle: "Satu alur terhubung dari pendaftaran hingga eksekusi instan",
    steps: [
      { icon: "🛡️", title: "Hubungkan akun & dompet", desc: "Buat akun dan tautkan dompet Anda dengan aman dalam hitungan menit." },
      { icon: "💰", title: "Alokasi & modal fleksibel", desc: "Pilih modal yang dialokasikan untuk setiap leader yang Anda ikuti." },
      { icon: "📊", title: "Analisis & saring leader Matrix", desc: "Bandingkan performa dan risiko untuk memilih leader yang tepat untuk Anda." },
      { icon: "⚡", title: "Eksekusi instan & kontrol otomatis", desc: "Transaksi disalin secara instan, dengan kontrol penuh untuk jeda atau berhenti mengikuti." },
    ],
  },
  vi: {
    badge: "Cách hoạt động",
    title: "Bốn bước để bắt đầu sao chép",
    subtitle: "Một hành trình liền mạch từ đăng ký đến thực thi tức thì",
    steps: [
      { icon: "🛡️", title: "Kết nối tài khoản và ví", desc: "Tạo tài khoản và liên kết ví của bạn an toàn chỉ trong vài phút." },
      { icon: "💰", title: "Phân bổ vốn linh hoạt", desc: "Chọn số vốn phân bổ cho mỗi leader bạn sao chép." },
      { icon: "📊", title: "Phân tích và lọc leader Matrix", desc: "So sánh hiệu suất và rủi ro để chọn leader phù hợp nhất." },
      { icon: "⚡", title: "Thực thi tức thì và kiểm soát tự động", desc: "Giao dịch được sao chép ngay lập tức, với toàn quyền tạm dừng hoặc hủy theo dõi." },
    ],
  },
  th: {
    badge: "วิธีการทำงาน",
    title: "สี่ขั้นตอนเพื่อเริ่มคัดลอก",
    subtitle: "เส้นทางเดียวที่เชื่อมต่อกันตั้งแต่สมัครสมาชิกจนถึงการดำเนินการทันที",
    steps: [
      { icon: "🛡️", title: "เชื่อมต่อบัญชีและกระเป๋าเงิน", desc: "สร้างบัญชีและเชื่อมโยงกระเป๋าเงินของคุณอย่างปลอดภัยในไม่กี่นาที" },
      { icon: "💰", title: "การจัดสรรและเงินทุนที่ยืดหยุ่น", desc: "เลือกเงินทุนที่จะจัดสรรให้กับผู้นำแต่ละคนที่คุณคัดลอกได้อย่างอิสระ" },
      { icon: "📊", title: "วิเคราะห์และคัดกรองผู้นำ Matrix", desc: "เปรียบเทียบผลงานและความเสี่ยงเพื่อเลือกผู้นำที่เหมาะกับคุณ" },
      { icon: "⚡", title: "การดำเนินการทันทีและการควบคุมอัตโนมัติ", desc: "การเทรดถูกคัดลอกทันที พร้อมการควบคุมเต็มรูปแบบในการหยุดชั่วคราวหรือเลิกติดตาม" },
    ],
  },
  bn: {
    badge: "এটি কীভাবে কাজ করে",
    title: "কপি শুরু করার জন্য চারটি ধাপ",
    subtitle: "সাইন-আপ থেকে তাৎক্ষণিক এক্সিকিউশন পর্যন্ত একটি সংযুক্ত পথ",
    steps: [
      { icon: "🛡️", title: "অ্যাকাউন্ট এবং ওয়ালেট সংযুক্ত করুন", desc: "মিনিটের মধ্যে নিরাপদে অ্যাকাউন্ট তৈরি করুন এবং ওয়ালেট লিঙ্ক করুন।" },
      { icon: "💰", title: "নমনীয় বরাদ্দ এবং মূলধন", desc: "প্রতিটি লিডারের জন্য বরাদ্দকৃত মূলধন স্বাধীনভাবে বেছে নিন।" },
      { icon: "📊", title: "Matrix লিডারদের বিশ্লেষণ ও ফিল্টার করুন", desc: "পারফরম্যান্স এবং ঝুঁকি তুলনা করে উপযুক্ত লিডার বেছে নিন।" },
      { icon: "⚡", title: "তাৎক্ষণিক এক্সিকিউশন এবং স্বয়ংক্রিয় নিয়ন্ত্রণ", desc: "ট্রেড তাৎক্ষণিকভাবে কপি হয়, থামানো বা আনফলো করার সম্পূর্ণ নিয়ন্ত্রণসহ।" },
    ],
  },
  sw: {
    badge: "Jinsi inavyofanya kazi",
    title: "Hatua nne za kuanza kunakili",
    subtitle: "Njia moja iliyounganishwa kutoka usajili hadi utekelezaji wa papo hapo",
    steps: [
      { icon: "🛡️", title: "Unganisha akaunti na pochi", desc: "Unda akaunti yako na uunganishe pochi yako kwa usalama ndani ya dakika." },
      { icon: "💰", title: "Ugavi na mtaji unaonyumbulika", desc: "Chagua mtaji wa kutenga kwa kila kiongozi unayenakili." },
      { icon: "📊", title: "Changanua na chuja viongozi wa Matrix", desc: "Linganisha utendaji na hatari kuchagua viongozi wanaokufaa." },
      { icon: "⚡", title: "Utekelezaji wa papo hapo na udhibiti wa kiotomatiki", desc: "Biashara zinanakiliwa papo hapo, ukiwa na udhibiti kamili wa kusitisha au kuacha kufuata." },
    ],
  },
};

function StepBadge({ index, icon, size }: { index: number; icon: string; size: "sm" | "lg" }) {
  const dims = size === "sm" ? "h-11 w-11 text-sm" : "h-14 w-14 text-base";
  return (
    <div
      className={`relative flex ${dims} shrink-0 items-center justify-center rounded-full border border-neon-cyan/40 bg-glass-surface font-bold text-neon-cyan shadow-[0_0_18px_-3px_rgba(34,211,238,0.7)] backdrop-blur-xl`}
    >
      {index + 1}
      <span className="absolute -bottom-1.5 -end-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-glass-border bg-background text-xs">
        {icon}
      </span>
    </div>
  );
}

export function HowItWorks({ locale }: { locale: Locale }) {
  const t = TEXT[locale] ?? TEXT.en;
  const lastIndex = t.steps.length - 1;

  return (
    <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
        <span className="line-clamp-1 text-xs font-medium text-neon-cyan">{t.badge}</span>
        <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="line-clamp-2 text-sm text-muted">{t.subtitle}</p>
      </div>

      {/* Mobile / tablet: vertical stepper, badge fused to the card on the
          reading-start side, connected by a neon line instead of stacked
          above with empty space. */}
      <div className="mx-auto flex w-full max-w-md flex-col md:hidden">
        {t.steps.map((s, i) => (
          <div key={s.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepBadge index={i} icon={s.icon} size="sm" />
              {i < lastIndex && (
                <div
                  className="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-neon-cyan/50 to-neon-cyan/0"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className={`flex-1 ${i < lastIndex ? "pb-4" : ""}`}>
              <div className="flex flex-col gap-1.5 rounded-2xl border border-glass-border bg-glass-surface p-4 backdrop-blur-xl transition hover:border-neon-cyan/30">
                <p className="line-clamp-2 text-base font-bold text-foreground">{s.title}</p>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: horizontal 4-column grid, badges linked by one
          continuous neon line running through the row. */}
      <div className="relative mx-auto hidden w-full max-w-5xl md:block">
        <div
          className="absolute top-7 right-7 left-7 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent"
          aria-hidden="true"
        />
        <div className="grid grid-cols-4 gap-4 lg:gap-6">
          {t.steps.map((s, i) => (
            <div key={s.title} className="relative flex h-full flex-col items-center gap-3 text-center">
              <StepBadge index={i} icon={s.icon} size="lg" />
              <div className="flex h-full w-full flex-col justify-start gap-1.5 rounded-2xl border border-glass-border bg-glass-surface p-4 backdrop-blur-xl transition hover:border-neon-cyan/30">
                <p className="line-clamp-2 text-base font-bold text-foreground">{s.title}</p>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
