import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { initialsAvatar } from "@/data/mockup-fixtures";

// Landing sections (eToro-like: start-aligned text, wide even spacing, thin 20px cards). Typography
// comes from the .ty-* classes in src/styles/tokens.css.

export const SECTION = "mx-auto w-full max-w-6xl px-5 py-14 md:px-6 md:py-20";
const CARD = "rounded-[20px] border border-white/10 bg-white/[0.03] p-6 md:p-7";

const FEATURE_ICONS: Record<string, ReactNode> = {
  demo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  stop: (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </>
  ),
  shield: <path d="M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {FEATURE_ICONS[name]}
    </svg>
  );
}

// Three short facts with small coloured icons; scrolls sideways on a phone.
export async function FeatureStrip() {
  const t = await getTranslations("Home");
  const items = [
    { icon: "demo", tone: "text-[#7FA8F8] bg-[#2f6fed]/15", title: t("trustStrip.demoTitle"), desc: t("trustStrip.demoDesc") },
    { icon: "stop", tone: "text-[#0ecb81] bg-[#0ecb81]/12", title: t("hero.trustShort1"), desc: t("hero.trust1") },
    { icon: "shield", tone: "text-[#f0a020] bg-[#f0a020]/12", title: t("hero.trustShort2"), desc: t("hero.trust2") },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl py-2 md:px-6">
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
        {items.map((it) => (
          <li key={it.icon} className="flex w-[78%] shrink-0 snap-start items-start gap-3.5 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 md:w-auto">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${it.tone}`}>
              <Icon name={it.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold text-[var(--text-primary)]">{it.title}</span>
              <span className="mt-0.5 block text-sm text-[var(--text-secondary)]">{it.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Three numbered steps with large coloured numerals.
export async function Steps() {
  const t = await getTranslations("Home.landing");
  const steps = [
    { n: "1", color: "text-[#7FA8F8]", title: t("step1Title"), desc: t("step1Desc") },
    { n: "2", color: "text-[#0ecb81]", title: t("step2Title"), desc: t("step2Desc") },
    { n: "3", color: "text-[#f0a020]", title: t("step3Title"), desc: t("step3Desc") },
  ];
  return (
    <section id="how-it-works" className={SECTION}>
      <h2 className="ty-section">{t("stepsTitle")}</h2>
      <ol className="mt-8 grid gap-4 md:mt-10 md:grid-cols-3 md:gap-5">
        {steps.map((s) => (
          <li key={s.n} className={CARD}>
            <span className={`ty-stat block ${s.color}`}>{s.n}</span>
            <h3 className="ty-card mt-5">{s.title}</h3>
            <p className="ty-body mt-2">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// "Big figure, title, one line" cards. Figures are verifiable facts about the platform.
const FIGURES = [
  { value: "$0", color: "text-[#7FA8F8]" },
  { value: "$10,000", color: "text-[#0ecb81]" },
  { value: "20+", color: "text-[#f0a020]" },
];

export async function FactCards() {
  const t = await getTranslations("Home.landing");
  const cards = [
    { ...FIGURES[0], title: t("card1Title"), desc: t("card1Desc") },
    { ...FIGURES[1], title: t("card2Title"), desc: t("card2Desc") },
    { ...FIGURES[2], title: t("card3Title"), desc: t("card3Desc") },
  ];
  return (
    <section className={SECTION}>
      <h2 className="ty-section">{t("cardsTitle")}</h2>
      <ul className="mt-8 grid gap-4 md:mt-10 md:grid-cols-3 md:gap-5">
        {cards.map((c) => (
          <li key={c.title} className={CARD}>
            <span dir="ltr" className={`ty-stat block text-start ${c.color}`}>
              {c.value}
            </span>
            <h3 className="ty-card mt-5">{c.title}</h3>
            <p className="ty-body mt-2">{c.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// An invented trader (fictional name, symbolic avatar, moderate figures), labelled as an illustration.
const DEMO_TRADER = { name: "Avery Northfield", copiers: "86", ret: "+4.1%" };

export async function TraderShowcase() {
  const t = await getTranslations("Home");
  const tl = await getTranslations("Home.landing");
  return (
    <section id="traders" className={`${SECTION} md:grid md:grid-cols-2 md:items-center md:gap-14`}>
      <div>
        <h2 className="ty-section">{tl("traderTitle")}</h2>
        <p className="ty-body mt-3 max-w-md">{tl("traderSubtitle")}</p>
      </div>
      <div className={`${CARD} mt-8 md:mt-0`}>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={initialsAvatar(DEMO_TRADER.name, 1)} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="ty-card">{DEMO_TRADER.name}</p>
            <span className="mt-1 inline-block rounded-full bg-[#0ecb81]/12 px-2.5 py-0.5 text-sm font-medium text-[#0ecb81]">{t("heroPreview.lowRisk")}</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <span dir="ltr" className="ty-stat block text-start text-[var(--text-primary)]">
              {DEMO_TRADER.copiers}
            </span>
            <span className="ty-body mt-2 block">{t("traders.copiers")}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <span dir="ltr" className="ty-stat block text-start text-[#0ecb81]">
              {DEMO_TRADER.ret}
            </span>
            <span className="ty-body mt-2 block">{tl("return30")}</span>
          </div>
        </div>
        <p className="ty-small mt-5">{tl("traderNote")}</p>
      </div>
    </section>
  );
}
