import type { Locale } from "@/i18n/locales";

// Three genuinely-true claims about how the platform is actually built --
// not compliance/regulatory badges. TLS is standard HTTPS (true for any
// deployed site); "at rest" encryption is Supabase/Postgres's managed
// infrastructure default; the audit log is real and already shown in the
// admin panel (every admin action + every wallet transaction is logged
// and reviewable).
type Badge = { title: string; desc: string };
type BadgeText = { tls: Badge; encrypted: Badge; audit: Badge };

const TEXT: Record<Locale, BadgeText> = {
  ar: {
    tls: { title: "تشفير TLS بطول 256-بت", desc: "لكل اتصال بالمنصة" },
    encrypted: { title: "بيانات مشفّرة أثناء النقل والتخزين", desc: "على بنية تحتية مُدارة" },
    audit: { title: "سجلات تدقيق شفافة", desc: "كل عملية قابلة للمراجعة" },
  },
  en: {
    tls: { title: "256-bit TLS Encryption", desc: "On every connection" },
    encrypted: { title: "Encrypted In Transit & At Rest", desc: "Managed infrastructure" },
    audit: { title: "Transparent Audit Logs", desc: "Every action reviewable" },
  },
  fr: {
    tls: { title: "Chiffrement TLS 256 bits", desc: "Sur chaque connexion" },
    encrypted: { title: "Chiffré en transit et au repos", desc: "Infrastructure gérée" },
    audit: { title: "Journaux d'audit transparents", desc: "Chaque action consultable" },
  },
  es: {
    tls: { title: "Cifrado TLS de 256 bits", desc: "En cada conexión" },
    encrypted: { title: "Cifrado en tránsito y en reposo", desc: "Infraestructura gestionada" },
    audit: { title: "Registros de auditoría transparentes", desc: "Cada acción revisable" },
  },
  pt: {
    tls: { title: "Criptografia TLS de 256 bits", desc: "Em cada conexão" },
    encrypted: { title: "Criptografado em trânsito e em repouso", desc: "Infraestrutura gerenciada" },
    audit: { title: "Registros de auditoria transparentes", desc: "Toda ação revisável" },
  },
  zh: {
    tls: { title: "256位 TLS 加密", desc: "每次连接均加密" },
    encrypted: { title: "传输与静态数据均加密", desc: "托管基础设施" },
    audit: { title: "透明审计日志", desc: "每项操作均可查阅" },
  },
  hi: {
    tls: { title: "256-बिट TLS एन्क्रिप्शन", desc: "हर कनेक्शन पर" },
    encrypted: { title: "ट्रांज़िट और रेस्ट में एन्क्रिप्टेड", desc: "प्रबंधित इंफ्रास्ट्रक्चर" },
    audit: { title: "पारदर्शी ऑडिट लॉग", desc: "हर कार्रवाई समीक्षा योग्य" },
  },
  ur: {
    tls: { title: "256-بٹ TLS انکرپشن", desc: "ہر کنکشن پر" },
    encrypted: { title: "ٹرانزٹ اور ریسٹ میں انکرپٹڈ", desc: "منظم انفراسٹرکچر" },
    audit: { title: "شفاف آڈٹ لاگز", desc: "ہر عمل قابل جائزہ" },
  },
  id: {
    tls: { title: "Enkripsi TLS 256-bit", desc: "Di setiap koneksi" },
    encrypted: { title: "Terenkripsi saat transit & disimpan", desc: "Infrastruktur terkelola" },
    audit: { title: "Log audit transparan", desc: "Setiap aksi dapat ditinjau" },
  },
  vi: {
    tls: { title: "Mã hóa TLS 256-bit", desc: "Trên mọi kết nối" },
    encrypted: { title: "Mã hóa khi truyền & lưu trữ", desc: "Hạ tầng được quản lý" },
    audit: { title: "Nhật ký kiểm tra minh bạch", desc: "Mọi hành động đều xem được" },
  },
  th: {
    tls: { title: "การเข้ารหัส TLS 256 บิต", desc: "ทุกการเชื่อมต่อ" },
    encrypted: { title: "เข้ารหัสระหว่างส่งและจัดเก็บ", desc: "โครงสร้างพื้นฐานที่มีการจัดการ" },
    audit: { title: "บันทึกการตรวจสอบที่โปร่งใส", desc: "ทุกการดำเนินการตรวจสอบได้" },
  },
  bn: {
    tls: { title: "২৫৬-বিট TLS এনক্রিপশন", desc: "প্রতিটি সংযোগে" },
    encrypted: { title: "ট্রানজিট ও সংরক্ষণে এনক্রিপ্টেড", desc: "ব্যবস্থাপিত অবকাঠামো" },
    audit: { title: "স্বচ্ছ অডিট লগ", desc: "প্রতিটি কার্যক্রম পর্যালোচনাযোগ্য" },
  },
  sw: {
    tls: { title: "Usimbaji TLS wa biti 256", desc: "Kwenye kila muunganisho" },
    encrypted: { title: "Imesimbwa wakati wa usafirishaji na uhifadhi", desc: "Miundombinu inayosimamiwa" },
    audit: { title: "Rekodi za ukaguzi wazi", desc: "Kila kitendo kinakaguliwa" },
  },
};

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function SecurityBadges({ locale, className = "" }: { locale: Locale; className?: string }) {
  const t = TEXT[locale] ?? TEXT.en;
  const badges = [
    { ...t.tls, Icon: LockIcon },
    { ...t.encrypted, Icon: ShieldIcon },
    { ...t.audit, Icon: ListIcon },
  ];

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${className}`}>
      {badges.map((b) => (
        <div
          key={b.title}
          className="flex items-center gap-3 rounded-xl border border-glass-border bg-glass-surface p-3.5 backdrop-blur-xl"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent shadow-[0_0_16px_-2px_var(--accent)]">
            <b.Icon />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{b.title}</p>
            <p className="truncate text-[11px] text-muted">{b.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
