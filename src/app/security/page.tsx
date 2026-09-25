import { getLocale } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";

type Section = { title: string; body: string };
type SecurityText = { title: string; intro: string; sections: Section[] };

const TEXT: Record<Locale, SecurityText> = {
  ar: {
    title: "الأمان والشفافية",
    intro: "أمان بيانات وأموال مستخدمينا هو أساس تصميم Copy Matrix، من التشفير إلى شفافية كل صفقة تُنفَّذ.",
    sections: [
      { title: "تشفير 256-Bit SSL/TLS", body: "جميع الاتصالات بين متصفحك وخوادم المنصة مشفّرة بمعيار TLS بطول مفتاح 256-بت، بما يحمي بيانات تسجيل الدخول وتفاصيل المحفظة من الاعتراض." },
      { title: "شفافية السجلات", body: "كل صفقة منسوخة وكل عملية إيداع أو سحب تُسجَّل ويمكن للمستخدم مراجعتها كاملة من سجل الصفقات وسجل المحفظة في أي وقت." },
      { title: "حساب تجريبي (Demo)", body: "يمكنك تجربة نسخ الصفقات ورؤية آلية عمل المنصة بالكامل عبر حساب تجريبي برصيد افتراضي، دون أي مخاطرة على أموالك الحقيقية." },
    ],
  },
  en: {
    title: "Security & Transparency",
    intro: "Protecting our users' data and funds is central to how Copy Matrix is built — from encryption to full transparency on every executed trade.",
    sections: [
      { title: "256-Bit SSL/TLS encryption", body: "All traffic between your browser and our servers is encrypted with 256-bit TLS, protecting login credentials and wallet details from interception." },
      { title: "Transparent records", body: "Every copied trade and every deposit or withdrawal is logged and fully reviewable by the user at any time from the trade history and wallet records." },
      { title: "Demo account", body: "Try copy trading and see exactly how the platform works with a risk-free demo account and a virtual balance — no real funds at risk." },
    ],
  },
  fr: {
    title: "Sécurité et transparence",
    intro: "Protéger les données et les fonds de nos utilisateurs est au cœur de la conception de Copy Matrix, du chiffrement à la transparence totale de chaque trade exécuté.",
    sections: [
      { title: "Chiffrement SSL/TLS 256 bits", body: "Tout le trafic entre votre navigateur et nos serveurs est chiffré avec TLS 256 bits, protégeant les identifiants de connexion et les détails du portefeuille contre toute interception." },
      { title: "Registres transparents", body: "Chaque trade copié et chaque dépôt ou retrait est enregistré et entièrement consultable par l'utilisateur à tout moment dans l'historique des trades et les registres du portefeuille." },
      { title: "Compte démo", body: "Essayez le copy trading et voyez exactement comment fonctionne la plateforme avec un compte démo sans risque et un solde virtuel — aucun fonds réel en jeu." },
    ],
  },
  es: {
    title: "Seguridad y transparencia",
    intro: "Proteger los datos y fondos de nuestros usuarios es fundamental en el diseño de Copy Matrix, desde el cifrado hasta la total transparencia de cada operación ejecutada.",
    sections: [
      { title: "Cifrado SSL/TLS de 256 bits", body: "Todo el tráfico entre tu navegador y nuestros servidores está cifrado con TLS de 256 bits, protegiendo tus credenciales de inicio de sesión y los detalles de tu billetera contra interceptación." },
      { title: "Registros transparentes", body: "Cada operación copiada y cada depósito o retiro queda registrado y puede ser revisado en su totalidad por el usuario en cualquier momento desde el historial de operaciones y los registros de la billetera." },
      { title: "Cuenta demo", body: "Prueba el copy trading y descubre exactamente cómo funciona la plataforma con una cuenta demo sin riesgo y saldo virtual, sin fondos reales en juego." },
    ],
  },
  pt: {
    title: "Segurança e transparência",
    intro: "Proteger os dados e fundos de nossos usuários é central no design do Copy Matrix, da criptografia à total transparência de cada operação executada.",
    sections: [
      { title: "Criptografia SSL/TLS de 256 bits", body: "Todo o tráfego entre seu navegador e nossos servidores é criptografado com TLS de 256 bits, protegendo credenciais de login e detalhes da carteira contra interceptação." },
      { title: "Registros transparentes", body: "Cada operação copiada e cada depósito ou saque é registrado e pode ser totalmente revisado pelo usuário a qualquer momento no histórico de operações e nos registros da carteira." },
      { title: "Conta demo", body: "Experimente o copy trading e veja exatamente como a plataforma funciona com uma conta demo sem risco e saldo virtual — sem fundos reais envolvidos." },
    ],
  },
  zh: {
    title: "安全与透明",
    intro: "保护用户的数据和资金是 Copy Matrix 设计的核心——从加密技术到每笔交易的完全透明。",
    sections: [
      { title: "256位 SSL/TLS 加密", body: "您的浏览器与我们服务器之间的所有通信均采用256位TLS加密，保护登录凭证和钱包信息免遭拦截。" },
      { title: "透明记录", body: "每一笔复制的交易以及每一次充值或提现都会被记录，用户可随时在交易历史和钱包记录中完整查阅。" },
      { title: "模拟账户", body: "通过无风险的模拟账户和虚拟余额体验跟单交易，准确了解平台运作方式——不涉及真实资金。" },
    ],
  },
  hi: {
    title: "सुरक्षा और पारदर्शिता",
    intro: "हमारे उपयोगकर्ताओं के डेटा और धन की सुरक्षा Copy Matrix के डिज़ाइन का केंद्र है — एन्क्रिप्शन से लेकर हर निष्पादित ट्रेड की पूर्ण पारदर्शिता तक।",
    sections: [
      { title: "256-बिट SSL/TLS एन्क्रिप्शन", body: "आपके ब्राउज़र और हमारे सर्वर के बीच सभी ट्रैफ़िक 256-बिट TLS के साथ एन्क्रिप्टेड है, जो लॉगिन क्रेडेंशियल और वॉलेट विवरण को इंटरसेप्शन से बचाता है।" },
      { title: "पारदर्शी रिकॉर्ड", body: "हर कॉपी किया गया ट्रेड और हर जमा या निकासी लॉग की जाती है और उपयोगकर्ता किसी भी समय ट्रेड इतिहास और वॉलेट रिकॉर्ड से इसे पूरी तरह देख सकता है।" },
      { title: "डेमो खाता", body: "जोखिम-मुक्त डेमो खाते और वर्चुअल बैलेंस के साथ कॉपी ट्रेडिंग आज़माएं और देखें कि प्लेटफ़ॉर्म वास्तव में कैसे काम करता है — कोई वास्तविक धन शामिल नहीं।" },
    ],
  },
  ur: {
    title: "سیکیورٹی اور شفافیت",
    intro: "ہمارے صارفین کے ڈیٹا اور فنڈز کی حفاظت Copy Matrix کے ڈیزائن کا مرکز ہے — انکرپشن سے لے کر ہر عملدرآمد شدہ ٹریڈ کی مکمل شفافیت تک۔",
    sections: [
      { title: "256-بٹ SSL/TLS انکرپشن", body: "آپ کے براؤزر اور ہمارے سرورز کے درمیان تمام ٹریفک 256-بٹ TLS کے ساتھ انکرپٹڈ ہے، جو لاگ ان کی تفصیلات اور والیٹ کی معلومات کو انٹرسیپشن سے محفوظ رکھتا ہے۔" },
      { title: "شفاف ریکارڈز", body: "ہر کاپی شدہ ٹریڈ اور ہر جمع یا نکاسی ریکارڈ کی جاتی ہے اور صارف کسی بھی وقت ٹریڈ ہسٹری اور والیٹ ریکارڈز سے اسے مکمل طور پر دیکھ سکتا ہے۔" },
      { title: "ڈیمو اکاؤنٹ", body: "بغیر کسی خطرے کے ڈیمو اکاؤنٹ اور ورچوئل بیلنس کے ساتھ کاپی ٹریڈنگ آزمائیں اور دیکھیں کہ پلیٹ فارم بالکل کیسے کام کرتا ہے — کوئی حقیقی فنڈز شامل نہیں۔" },
    ],
  },
  id: {
    title: "Keamanan & Transparansi",
    intro: "Melindungi data dan dana pengguna kami adalah inti dari desain Copy Matrix, mulai dari enkripsi hingga transparansi penuh atas setiap transaksi yang dieksekusi.",
    sections: [
      { title: "Enkripsi SSL/TLS 256-Bit", body: "Semua lalu lintas antara browser Anda dan server kami dienkripsi dengan TLS 256-bit, melindungi kredensial login dan detail dompet dari penyadapan." },
      { title: "Catatan transparan", body: "Setiap transaksi yang disalin dan setiap setoran atau penarikan dicatat dan dapat ditinjau sepenuhnya oleh pengguna kapan saja dari riwayat transaksi dan catatan dompet." },
      { title: "Akun demo", body: "Coba copy trading dan lihat persis bagaimana platform bekerja dengan akun demo bebas risiko dan saldo virtual — tanpa dana nyata yang dipertaruhkan." },
    ],
  },
  vi: {
    title: "Bảo mật & Minh bạch",
    intro: "Bảo vệ dữ liệu và tiền của người dùng là trọng tâm trong thiết kế của Copy Matrix, từ mã hóa đến minh bạch hoàn toàn trong từng giao dịch được thực thi.",
    sections: [
      { title: "Mã hóa SSL/TLS 256-Bit", body: "Toàn bộ lưu lượng giữa trình duyệt của bạn và máy chủ của chúng tôi được mã hóa bằng TLS 256-bit, bảo vệ thông tin đăng nhập và chi tiết ví khỏi bị đánh chặn." },
      { title: "Hồ sơ minh bạch", body: "Mỗi giao dịch được sao chép và mỗi lần nạp hoặc rút tiền đều được ghi lại và người dùng có thể xem đầy đủ bất cứ lúc nào từ lịch sử giao dịch và hồ sơ ví." },
      { title: "Tài khoản demo", body: "Thử sao chép giao dịch và xem chính xác cách nền tảng hoạt động với tài khoản demo không rủi ro và số dư ảo — không có tiền thật liên quan." },
    ],
  },
  th: {
    title: "ความปลอดภัยและความโปร่งใส",
    intro: "การปกป้องข้อมูลและเงินทุนของผู้ใช้เป็นหัวใจสำคัญของการออกแบบ Copy Matrix ตั้งแต่การเข้ารหัสไปจนถึงความโปร่งใสอย่างเต็มที่ในทุกการเทรดที่ดำเนินการ",
    sections: [
      { title: "การเข้ารหัส SSL/TLS 256 บิต", body: "การรับส่งข้อมูลทั้งหมดระหว่างเบราว์เซอร์ของคุณและเซิร์ฟเวอร์ของเราถูกเข้ารหัสด้วย TLS 256 บิต ปกป้องข้อมูลรับรองการเข้าสู่ระบบและรายละเอียดกระเป๋าเงินจากการดักจับ" },
      { title: "บันทึกที่โปร่งใส", body: "ทุกการเทรดที่คัดลอกและทุกการฝากหรือถอนเงินจะถูกบันทึกไว้ และผู้ใช้สามารถตรวจสอบได้อย่างครบถ้วนได้ตลอดเวลาจากประวัติการเทรดและบันทึกกระเป๋าเงิน" },
      { title: "บัญชีทดลอง", body: "ลองคัดลอกการเทรดและดูวิธีการทำงานของแพลตฟอร์มอย่างชัดเจนด้วยบัญชีทดลองที่ปลอดความเสี่ยงและยอดคงเหลือเสมือนจริง โดยไม่มีเงินจริงเข้ามาเกี่ยวข้อง" },
    ],
  },
  bn: {
    title: "নিরাপত্তা ও স্বচ্ছতা",
    intro: "আমাদের ব্যবহারকারীদের ডেটা এবং তহবিল রক্ষা করা Copy Matrix-এর ডিজাইনের কেন্দ্রবিন্দু — এনক্রিপশন থেকে শুরু করে প্রতিটি সম্পাদিত ট্রেডের সম্পূর্ণ স্বচ্ছতা পর্যন্ত।",
    sections: [
      { title: "২৫৬-বিট SSL/TLS এনক্রিপশন", body: "আপনার ব্রাউজার এবং আমাদের সার্ভারের মধ্যে সমস্ত ট্রাফিক ২৫৬-বিট TLS দিয়ে এনক্রিপ্ট করা থাকে, যা লগইন তথ্য এবং ওয়ালেট বিবরণকে ইন্টারসেপশন থেকে রক্ষা করে।" },
      { title: "স্বচ্ছ রেকর্ড", body: "প্রতিটি কপি করা ট্রেড এবং প্রতিটি জমা বা উত্তোলন লগ করা হয় এবং ব্যবহারকারী যেকোনো সময় ট্রেড হিস্টোরি এবং ওয়ালেট রেকর্ড থেকে সম্পূর্ণভাবে পর্যালোচনা করতে পারেন।" },
      { title: "ডেমো অ্যাকাউন্ট", body: "ঝুঁকিমুক্ত ডেমো অ্যাকাউন্ট এবং ভার্চুয়াল ব্যালেন্স দিয়ে কপি ট্রেডিং চেষ্টা করুন এবং দেখুন প্ল্যাটফর্মটি ঠিক কীভাবে কাজ করে — কোনো প্রকৃত তহবিল জড়িত নয়।" },
    ],
  },
  sw: {
    title: "Usalama na Uwazi",
    intro: "Kulinda data na fedha za watumiaji wetu ni msingi wa jinsi Copy Matrix ilivyojengwa — kutoka usimbaji fiche hadi uwazi kamili katika kila biashara inayotekelezwa.",
    sections: [
      { title: "Usimbaji fiche wa SSL/TLS wa biti 256", body: "Trafiki yote kati ya kivinjari chako na seva zetu imesimbwa kwa TLS ya biti 256, ikilinda vitambulisho vya kuingia na maelezo ya pochi dhidi ya kunaswa." },
      { title: "Rekodi za wazi", body: "Kila biashara iliyonakiliwa na kila uwekaji au utoaji hurekodiwa na mtumiaji anaweza kukagua kikamilifu wakati wowote kutoka historia ya biashara na rekodi za pochi." },
      { title: "Akaunti ya jaribio", body: "Jaribu biashara ya kunakili na uone jinsi jukwaa linavyofanya kazi kwa akaunti ya jaribio isiyo na hatari na salio la kudhahania — bila fedha halisi kuhusika." },
    ],
  },
};

export function generateMetadata() {
  return { title: "Copy Matrix — Security" };
}

export default async function SecurityPage() {
  const locale = (await getLocale()) as Locale;
  const t = TEXT[locale] ?? TEXT.en;
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
