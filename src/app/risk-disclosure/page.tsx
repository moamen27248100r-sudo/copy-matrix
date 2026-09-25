import { getLocale } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";

type Section = { title: string; body: string };
type RiskText = { title: string; intro: string; sections: Section[] };

const TEXT: Record<Locale, RiskText> = {
  ar: {
    title: "تحذير المخاطر",
    intro: "Copy Matrix هي منصة برمجية (Software Platform) لتنفيذ ونسخ إشارات التداول، وليست مؤسسة مالية أو بنكاً أو وسيط تداول مرخّصاً.",
    sections: [
      { title: "طبيعة المنصة", body: "توفر المنصة أدوات برمجية لعرض أداء القادة ونسخ صفقاتهم آلياً. جميع الأرصدة والصفقات المعروضة تعكس نشاطاً تعاقدياً بين المستخدم والمنصة، ولا تمثل ضماناً بعائد مستقبلي." },
      { title: "السحب والإيداع", body: "تتم عمليات الإيداع والسحب حصراً عبر بوابة الكريبتو المتاحة في صفحة المحفظة. المستخدم مسؤول عن التحقق من صحة عنوان المحفظة والشبكة المستخدمة قبل تأكيد أي عملية." },
      { title: "فك الارتباط الفوري", body: "يمكن لأي مستخدم إيقاف نسخ أي قائد فوراً بضغطة زر (One-Click Unfollow) من صفحة المحفظة، مع توقف تنفيذ أي صفقات جديدة لذلك القائد فور الفك." },
      { title: "تحذير تنظيمي", body: "التداول ونسخ الصفقات ينطويان على مخاطرة عالية وقد يؤدي إلى خسارة كامل رأس المال المستثمر. لا تُعد هذه الصفحة استشارة مالية أو قانونية، ويجب على كل مستخدم تقييم وضعه المالي وقوانين بلده قبل استخدام المنصة." },
    ],
  },
  en: {
    title: "Risk Disclosure",
    intro: "Copy Matrix is a software platform for executing and copying trading signals — it is not a financial institution, a bank, or a licensed brokerage.",
    sections: [
      { title: "Nature of the platform", body: "The platform provides software tools to display leader performance and automatically copy their trades. Balances and trades shown reflect a contractual relationship between the user and the platform, and are not a guarantee of future returns." },
      { title: "Deposits & withdrawals", body: "Deposits and withdrawals are processed exclusively through the crypto gateway available on the portfolio page. Users are responsible for verifying the wallet address and network before confirming any transaction." },
      { title: "Instant unfollow", body: "Any user can stop copying a leader instantly with one click (One-Click Unfollow) from the portfolio page; no new trades are copied from that leader once unfollowed." },
      { title: "Regulatory warning", body: "Trading and copy trading carry a high level of risk and may result in the loss of the entire invested capital. This page is not financial or legal advice — every user should assess their own financial situation and local laws before using the platform." },
    ],
  },
  fr: {
    title: "Avertissement sur les risques",
    intro: "Copy Matrix est une plateforme logicielle (Software Platform) d'exécution et de copie de signaux de trading, et non une institution financière, une banque ou un courtier agréé.",
    sections: [
      { title: "Nature de la plateforme", body: "La plateforme fournit des outils logiciels pour afficher la performance des leaders et copier automatiquement leurs trades. Les soldes et trades affichés reflètent une relation contractuelle entre l'utilisateur et la plateforme, et ne garantissent aucun rendement futur." },
      { title: "Dépôts et retraits", body: "Les dépôts et retraits sont traités exclusivement via la passerelle crypto disponible sur la page portefeuille. L'utilisateur est responsable de vérifier l'adresse du portefeuille et le réseau avant de confirmer toute transaction." },
      { title: "Désabonnement instantané", body: "Tout utilisateur peut arrêter de copier un leader instantanément en un clic (One-Click Unfollow) depuis la page portefeuille ; aucun nouveau trade n'est copié de ce leader une fois désabonné." },
      { title: "Avertissement réglementaire", body: "Le trading et le copy trading comportent un niveau de risque élevé et peuvent entraîner la perte de la totalité du capital investi. Cette page ne constitue pas un conseil financier ou juridique — chaque utilisateur doit évaluer sa propre situation financière et les lois locales avant d'utiliser la plateforme." },
    ],
  },
  es: {
    title: "Aviso de riesgo",
    intro: "Copy Matrix es una plataforma de software para ejecutar y copiar señales de trading — no es una institución financiera, un banco ni un bróker autorizado.",
    sections: [
      { title: "Naturaleza de la plataforma", body: "La plataforma ofrece herramientas de software para mostrar el rendimiento de los líderes y copiar automáticamente sus operaciones. Los saldos y operaciones mostrados reflejan una relación contractual entre el usuario y la plataforma, y no garantizan rendimientos futuros." },
      { title: "Depósitos y retiros", body: "Los depósitos y retiros se procesan exclusivamente a través de la pasarela cripto disponible en la página de portafolio. El usuario es responsable de verificar la dirección de la billetera y la red antes de confirmar cualquier transacción." },
      { title: "Cancelación instantánea", body: "Cualquier usuario puede dejar de copiar a un líder al instante con un clic (One-Click Unfollow) desde la página de portafolio; no se copiará ninguna operación nueva de ese líder una vez cancelado." },
      { title: "Aviso regulatorio", body: "El trading y el copy trading implican un alto nivel de riesgo y pueden provocar la pérdida total del capital invertido. Esta página no constituye asesoría financiera o legal — cada usuario debe evaluar su propia situación financiera y las leyes locales antes de usar la plataforma." },
    ],
  },
  pt: {
    title: "Aviso de risco",
    intro: "Copy Matrix é uma plataforma de software para execução e cópia de sinais de negociação — não é uma instituição financeira, um banco ou uma corretora licenciada.",
    sections: [
      { title: "Natureza da plataforma", body: "A plataforma fornece ferramentas de software para exibir o desempenho dos líderes e copiar automaticamente suas operações. Os saldos e operações exibidos refletem uma relação contratual entre o usuário e a plataforma, e não garantem retornos futuros." },
      { title: "Depósitos e saques", body: "Depósitos e saques são processados exclusivamente através do gateway de cripto disponível na página de carteira. O usuário é responsável por verificar o endereço da carteira e a rede antes de confirmar qualquer transação." },
      { title: "Cancelamento instantâneo", body: "Qualquer usuário pode parar de copiar um líder instantaneamente com um clique (One-Click Unfollow) na página de carteira; nenhuma nova operação será copiada desse líder após o cancelamento." },
      { title: "Aviso regulatório", body: "Negociar e copiar operações envolve alto nível de risco e pode resultar na perda total do capital investido. Esta página não constitui aconselhamento financeiro ou jurídico — cada usuário deve avaliar sua própria situação financeira e as leis locais antes de usar a plataforma." },
    ],
  },
  zh: {
    title: "风险披露",
    intro: "Copy Matrix 是一个用于执行和复制交易信号的软件平台，并非金融机构、银行或持牌经纪商。",
    sections: [
      { title: "平台性质", body: "该平台提供软件工具以展示领导者的业绩并自动复制其交易。所显示的余额和交易反映的是用户与平台之间的合同关系，并不保证未来回报。" },
      { title: "充值与提现", body: "充值和提现仅通过投资组合页面提供的加密网关处理。用户在确认任何交易前有责任核实钱包地址和所用网络。" },
      { title: "即时取消关注", body: "任何用户都可以在投资组合页面通过一键操作（One-Click Unfollow）立即停止跟随某位领导者；取消关注后将不再复制该领导者的任何新交易。" },
      { title: "监管警告", body: "交易和跟单交易具有较高风险，可能导致全部投入资金的损失。本页面不构成财务或法律建议——每位用户在使用平台前应评估自身财务状况及当地法律。" },
    ],
  },
  hi: {
    title: "जोखिम प्रकटीकरण",
    intro: "Copy Matrix ट्रेडिंग सिग्नल्स को निष्पादित और कॉपी करने के लिए एक सॉफ्टवेयर प्लेटफ़ॉर्म है — यह कोई वित्तीय संस्था, बैंक या लाइसेंस प्राप्त ब्रोकरेज नहीं है।",
    sections: [
      { title: "प्लेटफ़ॉर्म की प्रकृति", body: "यह प्लेटफ़ॉर्म लीडर्स के प्रदर्शन को दिखाने और उनके ट्रेड्स को स्वचालित रूप से कॉपी करने के लिए सॉफ्टवेयर टूल प्रदान करता है। दिखाए गए बैलेंस और ट्रेड्स उपयोगकर्ता और प्लेटफ़ॉर्म के बीच एक संविदात्मक संबंध को दर्शाते हैं, और भविष्य के रिटर्न की गारंटी नहीं देते।" },
      { title: "जमा और निकासी", body: "जमा और निकासी केवल पोर्टफोलियो पेज पर उपलब्ध क्रिप्टो गेटवे के माध्यम से संसाधित की जाती हैं। किसी भी लेनदेन की पुष्टि करने से पहले वॉलेट पता और नेटवर्क सत्यापित करना उपयोगकर्ता की जिम्मेदारी है।" },
      { title: "तुरंत अनफॉलो", body: "कोई भी उपयोगकर्ता पोर्टफोलियो पेज से एक क्लिक (One-Click Unfollow) में तुरंत किसी लीडर को कॉपी करना बंद कर सकता है; अनफॉलो करने के बाद उस लीडर के कोई नए ट्रेड कॉपी नहीं होंगे।" },
      { title: "नियामक चेतावनी", body: "ट्रेडिंग और कॉपी ट्रेडिंग में उच्च स्तर का जोखिम शामिल है और इससे निवेशित पूंजी का पूरा नुकसान हो सकता है। यह पृष्ठ वित्तीय या कानूनी सलाह नहीं है — प्लेटफ़ॉर्म का उपयोग करने से पहले प्रत्येक उपयोगकर्ता को अपनी वित्तीय स्थिति और स्थानीय कानूनों का आकलन करना चाहिए।" },
    ],
  },
  ur: {
    title: "خطرے کا انکشاف",
    intro: "Copy Matrix ٹریڈنگ سگنلز کو عملی جامہ پہنانے اور کاپی کرنے کے لیے ایک سافٹ ویئر پلیٹ فارم ہے — یہ کوئی مالیاتی ادارہ، بینک یا لائسنس یافتہ بروکریج نہیں ہے۔",
    sections: [
      { title: "پلیٹ فارم کی نوعیت", body: "یہ پلیٹ فارم لیڈرز کی کارکردگی دکھانے اور ان کے ٹریڈز خودکار طور پر کاپی کرنے کے لیے سافٹ ویئر ٹولز فراہم کرتا ہے۔ دکھائے گئے بیلنس اور ٹریڈز صارف اور پلیٹ فارم کے مابین ایک معاہداتی تعلق کو ظاہر کرتے ہیں، اور مستقبل کے منافع کی ضمانت نہیں دیتے۔" },
      { title: "جمع اور نکاسی", body: "جمع اور نکاسی صرف پورٹ فولیو پیج پر دستیاب کرپٹو گیٹ وے کے ذریعے پراسیس کی جاتی ہیں۔ کسی بھی لین دین کی تصدیق سے پہلے والیٹ ایڈریس اور نیٹ ورک کی تصدیق کرنا صارف کی ذمہ داری ہے۔" },
      { title: "فوری ان فالو", body: "کوئی بھی صارف پورٹ فولیو پیج سے ایک کلک (One-Click Unfollow) میں فوری طور پر کسی لیڈر کو کاپی کرنا بند کر سکتا ہے؛ ان فالو کرنے کے بعد اس لیڈر کے کوئی نئے ٹریڈز کاپی نہیں ہوں گے۔" },
      { title: "ریگولیٹری تنبیہ", body: "ٹریڈنگ اور کاپی ٹریڈنگ میں خطرے کی اعلیٰ سطح شامل ہے اور اس سے لگائے گئے پورے سرمائے کے ضیاع کا امکان ہے۔ یہ صفحہ مالی یا قانونی مشورہ نہیں ہے — پلیٹ فارم استعمال کرنے سے پہلے ہر صارف کو اپنی مالی صورتحال اور مقامی قوانین کا جائزہ لینا چاہیے۔" },
    ],
  },
  id: {
    title: "Pengungkapan Risiko",
    intro: "Copy Matrix adalah platform perangkat lunak untuk mengeksekusi dan menyalin sinyal trading — bukan lembaga keuangan, bank, atau pialang berlisensi.",
    sections: [
      { title: "Sifat platform", body: "Platform ini menyediakan alat perangkat lunak untuk menampilkan performa leader dan secara otomatis menyalin transaksi mereka. Saldo dan transaksi yang ditampilkan mencerminkan hubungan kontraktual antara pengguna dan platform, dan bukan jaminan pengembalian di masa depan." },
      { title: "Setor & tarik dana", body: "Setor dan tarik dana diproses secara eksklusif melalui gateway kripto yang tersedia di halaman portofolio. Pengguna bertanggung jawab untuk memverifikasi alamat dompet dan jaringan sebelum mengonfirmasi transaksi apa pun." },
      { title: "Berhenti mengikuti instan", body: "Setiap pengguna dapat berhenti menyalin leader secara instan dengan satu klik (One-Click Unfollow) dari halaman portofolio; tidak ada transaksi baru yang disalin dari leader tersebut setelah berhenti mengikuti." },
      { title: "Peringatan regulasi", body: "Trading dan copy trading memiliki tingkat risiko tinggi dan dapat mengakibatkan kehilangan seluruh modal yang diinvestasikan. Halaman ini bukan nasihat keuangan atau hukum — setiap pengguna harus menilai situasi keuangan dan hukum setempat sebelum menggunakan platform." },
    ],
  },
  vi: {
    title: "Công bố rủi ro",
    intro: "Copy Matrix là nền tảng phần mềm để thực thi và sao chép tín hiệu giao dịch — không phải là tổ chức tài chính, ngân hàng hay công ty môi giới được cấp phép.",
    sections: [
      { title: "Bản chất của nền tảng", body: "Nền tảng cung cấp các công cụ phần mềm để hiển thị hiệu suất của leader và tự động sao chép giao dịch của họ. Số dư và giao dịch hiển thị phản ánh mối quan hệ hợp đồng giữa người dùng và nền tảng, không đảm bảo lợi nhuận trong tương lai." },
      { title: "Nạp và rút tiền", body: "Nạp và rút tiền chỉ được xử lý qua cổng crypto có sẵn trên trang danh mục đầu tư. Người dùng có trách nhiệm xác minh địa chỉ ví và mạng lưới trước khi xác nhận bất kỳ giao dịch nào." },
      { title: "Hủy theo dõi tức thì", body: "Bất kỳ người dùng nào cũng có thể ngừng sao chép một leader ngay lập tức chỉ với một cú nhấp (One-Click Unfollow) từ trang danh mục đầu tư; không có giao dịch mới nào được sao chép từ leader đó sau khi hủy theo dõi." },
      { title: "Cảnh báo quy định", body: "Giao dịch và sao chép giao dịch mang rủi ro cao và có thể dẫn đến mất toàn bộ vốn đầu tư. Trang này không phải là tư vấn tài chính hoặc pháp lý — mỗi người dùng nên đánh giá tình hình tài chính của mình và luật pháp địa phương trước khi sử dụng nền tảng." },
    ],
  },
  th: {
    title: "การเปิดเผยความเสี่ยง",
    intro: "Copy Matrix เป็นแพลตฟอร์มซอฟต์แวร์สำหรับดำเนินการและคัดลอกสัญญาณการเทรด ไม่ใช่สถาบันการเงิน ธนาคาร หรือโบรกเกอร์ที่ได้รับใบอนุญาต",
    sections: [
      { title: "ลักษณะของแพลตฟอร์ม", body: "แพลตฟอร์มนี้มอบเครื่องมือซอฟต์แวร์เพื่อแสดงผลงานของผู้นำและคัดลอกการเทรดของพวกเขาโดยอัตโนมัติ ยอดคงเหลือและการเทรดที่แสดงสะท้อนความสัมพันธ์ตามสัญญาระหว่างผู้ใช้และแพลตฟอร์ม ไม่ใช่การรับประกันผลตอบแทนในอนาคต" },
      { title: "การฝากและถอนเงิน", body: "การฝากและถอนเงินดำเนินการผ่านเกตเวย์คริปโตที่มีอยู่ในหน้าพอร์ตโฟลิโอเท่านั้น ผู้ใช้มีหน้าที่ตรวจสอบที่อยู่กระเป๋าเงินและเครือข่ายก่อนยืนยันธุรกรรมใด ๆ" },
      { title: "การเลิกติดตามทันที", body: "ผู้ใช้ทุกคนสามารถหยุดคัดลอกผู้นำได้ทันทีด้วยการคลิกเดียว (One-Click Unfollow) จากหน้าพอร์ตโฟลิโอ จะไม่มีการคัดลอกการเทรดใหม่จากผู้นำคนนั้นหลังจากเลิกติดตาม" },
      { title: "คำเตือนด้านกฎระเบียบ", body: "การเทรดและการคัดลอกการเทรดมีความเสี่ยงสูงและอาจทำให้สูญเสียเงินลงทุนทั้งหมด หน้านี้ไม่ใช่คำแนะนำทางการเงินหรือกฎหมาย ผู้ใช้แต่ละคนควรประเมินสถานะทางการเงินและกฎหมายท้องถิ่นของตนก่อนใช้แพลตฟอร์ม" },
    ],
  },
  bn: {
    title: "ঝুঁকি প্রকাশ",
    intro: "Copy Matrix ট্রেডিং সিগন্যাল কার্যকর ও কপি করার জন্য একটি সফটওয়্যার প্ল্যাটফর্ম — এটি কোনো আর্থিক প্রতিষ্ঠান, ব্যাংক বা লাইসেন্সপ্রাপ্ত ব্রোকারেজ নয়।",
    sections: [
      { title: "প্ল্যাটফর্মের প্রকৃতি", body: "এই প্ল্যাটফর্ম লিডারদের পারফরম্যান্স প্রদর্শন এবং তাদের ট্রেড স্বয়ংক্রিয়ভাবে কপি করার জন্য সফটওয়্যার টুল সরবরাহ করে। প্রদর্শিত ব্যালেন্স এবং ট্রেডগুলো ব্যবহারকারী এবং প্ল্যাটফর্মের মধ্যে একটি চুক্তিভিত্তিক সম্পর্ক প্রতিফলিত করে, এবং ভবিষ্যতের রিটার্নের গ্যারান্টি দেয় না।" },
      { title: "জমা ও উত্তোলন", body: "জমা এবং উত্তোলন শুধুমাত্র পোর্টফোলিও পেজে উপলব্ধ ক্রিপ্টো গেটওয়ের মাধ্যমে প্রক্রিয়া করা হয়। যেকোনো লেনদেন নিশ্চিত করার আগে ওয়ালেট ঠিকানা এবং নেটওয়ার্ক যাচাই করা ব্যবহারকারীর দায়িত্ব।" },
      { title: "তাৎক্ষণিক আনফলো", body: "যেকোনো ব্যবহারকারী পোর্টফোলিও পেজ থেকে এক ক্লিকে (One-Click Unfollow) তাৎক্ষণিকভাবে কোনো লিডারকে কপি করা বন্ধ করতে পারেন; আনফলো করার পর সেই লিডারের কোনো নতুন ট্রেড কপি হবে না।" },
      { title: "নিয়ন্ত্রক সতর্কতা", body: "ট্রেডিং এবং কপি ট্রেডিং উচ্চ মাত্রার ঝুঁকি বহন করে এবং বিনিয়োগকৃত সম্পূর্ণ মূলধন হারানোর কারণ হতে পারে। এই পৃষ্ঠাটি আর্থিক বা আইনি পরামর্শ নয় — প্ল্যাটফর্ম ব্যবহারের আগে প্রতিটি ব্যবহারকারীর নিজস্ব আর্থিক অবস্থা এবং স্থানীয় আইন মূল্যায়ন করা উচিত।" },
    ],
  },
  sw: {
    title: "Ufichuzi wa Hatari",
    intro: "Copy Matrix ni jukwaa la programu la kutekeleza na kunakili ishara za biashara — si taasisi ya kifedha, benki, au wakala wa dalali aliyeidhinishwa.",
    sections: [
      { title: "Asili ya jukwaa", body: "Jukwaa hutoa zana za programu za kuonyesha utendaji wa viongozi na kunakili biashara zao kiotomatiki. Salio na biashara zinazoonyeshwa zinaonyesha uhusiano wa kimkataba kati ya mtumiaji na jukwaa, na si dhamana ya faida za baadaye." },
      { title: "Uwekaji na utoaji", body: "Uwekaji na utoaji hufanywa pekee kupitia lango la crypto linalopatikana kwenye ukurasa wa portfolio. Mtumiaji ana jukumu la kuthibitisha anwani ya pochi na mtandao kabla ya kuthibitisha muamala wowote." },
      { title: "Kuacha kufuata papo hapo", body: "Mtumiaji yeyote anaweza kuacha kunakili kiongozi papo hapo kwa mbofyo mmoja (One-Click Unfollow) kutoka ukurasa wa portfolio; hakuna biashara mpya itakayonakiliwa kutoka kwa kiongozi huyo baada ya kuacha kufuata." },
      { title: "Onyo la kisheria", body: "Biashara na biashara ya kunakili zinahusisha kiwango cha juu cha hatari na zinaweza kusababisha upotevu wa mtaji wote uliowekezwa. Ukurasa huu si ushauri wa kifedha au kisheria — kila mtumiaji anapaswa kutathmini hali yake ya kifedha na sheria za mahali husika kabla ya kutumia jukwaa." },
    ],
  },
};

export function generateMetadata() {
  return { title: "Copy Matrix — Risk Disclosure" };
}

export default async function RiskDisclosurePage() {
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
