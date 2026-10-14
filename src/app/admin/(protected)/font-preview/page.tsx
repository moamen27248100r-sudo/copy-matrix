import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Noto_Sans_Arabic } from "next/font/google";

// Typography preview for the notification list -- NOT applied anywhere on the platform.
// Hidden: not linked from any menu, admin accounts only (the protected admin layout), not indexable.
// Two Arabic faces, both paired with Inter for the Latin letters and the numerals:
//   A: IBM Plex Sans Arabic + Inter (what the platform uses today)
//   B: Noto Sans Arabic + Inter

export const metadata: Metadata = {
  title: "Font preview",
  robots: { index: false, follow: false, nocache: true },
};

const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const noto = Noto_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

type Sample = { title: string; body: string; time: string; unread: boolean };

const AR: Sample[] = [
  { title: "تم إغلاق الصفقة", body: "أُغلقت صفقتك XAUUSD المنسوخة من Max Zimmermann بنتيجة +$34.20.", time: "اليوم · 3:29 م", unread: true },
  { title: "توقّف النسخ تلقائياً", body: "وصل الخسارة إلى حد 50% من المبلغ المخصص $200، فتوقّف نسخ Michael Turner. يمكنك المتابعة في أي وقت.", time: "أمس · 11:05 ص", unread: true },
  { title: "حركة كبيرة في BTC/USDT", body: "BTC/USDT ارتفع بنسبة 4.82% خلال آخر 24 ساعة، والسعر الآن 81,934.", time: "14 أكتوبر · 8:40 ص", unread: false },
  { title: "تم قبول طلب التوثيق", body: "تم توثيق هويتك بنجاح ويمكنك الآن الإيداع والسحب بحساب حقيقي.", time: "12 أكتوبر · 6:12 م", unread: false },
];

const EN: Sample[] = [
  { title: "Trade closed", body: "Your XAUUSD trade copied from Max Zimmermann closed with a result of +$34.20.", time: "Today · 3:29 PM", unread: true },
  { title: "Copying stopped automatically", body: "The loss reached the 50% limit of the $200 allocated, so copying Michael Turner stopped. You can resume anytime.", time: "Yesterday · 11:05 AM", unread: true },
  { title: "Big move in BTC/USDT", body: "BTC/USDT rose 4.82% over the last 24 hours and now trades at 81,934.", time: "Oct 14 · 8:40 AM", unread: false },
  { title: "Identity verification approved", body: "Your identity was verified. You can now deposit and withdraw with a real account.", time: "Oct 12 · 6:12 PM", unread: false },
];

function Column({ label, family, fontFamily, samples, dir }: { label: string; family: string; fontFamily: string; samples: Sample[]; dir: "rtl" | "ltr" }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">{label}</h2>
        <p className="text-xs text-muted">{family}</p>
      </div>
      <ul className="flex flex-col gap-2" dir={dir} style={{ fontFamily, fontVariantNumeric: "tabular-nums" }}>
        {samples.map((n) => (
          <li
            key={n.title}
            className={`relative flex items-start gap-3 overflow-hidden rounded-lg border p-3.5 ${n.unread ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}
          >
            {n.unread && <span className="absolute inset-y-0 start-0 w-1 bg-accent" aria-hidden="true" />}
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-accent" : "bg-transparent"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-snug text-white">{n.title}</p>
              <p className="mt-1 text-[15px] font-normal text-[#E3E8F2]" style={{ lineHeight: dir === "rtl" ? 1.6 : 1.5 }}>
                {n.body}
              </p>
              <p className="mt-1.5 text-xs font-normal text-[#8B95A7]">{n.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FontPreviewPage() {
  // Latin letters and numerals always come from Inter (first in the stack); the Arabic glyphs fall
  // through to the chosen Arabic face -- exactly how the platform stacks its fonts.
  const a = `${inter.style.fontFamily}, ${plex.style.fontFamily}, sans-serif`;
  const b = `${inter.style.fontFamily}, ${noto.style.fontFamily}, sans-serif`;
  const latin = `${inter.style.fontFamily}, sans-serif`;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Notification font preview</h1>
        <p className="text-sm text-muted">
          Side by side, same copy, same sizes. Title weight 600 (17px), message weight 400 (15px, line height 1.6 for Arabic), time small grey, a dot for unread, strong contrast, tabular
          numerals. Not applied to the platform.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Column label="A — IBM Plex Sans Arabic + Inter" family="IBM Plex Sans Arabic / Inter" fontFamily={a} samples={AR} dir="rtl" />
        <Column label="B — Noto Sans Arabic + Inter" family="Noto Sans Arabic / Inter" fontFamily={b} samples={AR} dir="rtl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Column label="A — English (Inter)" family="Inter" fontFamily={latin} samples={EN} dir="ltr" />
        <Column label="B — English (Inter)" family="Inter" fontFamily={latin} samples={EN} dir="ltr" />
      </div>
    </div>
  );
}
