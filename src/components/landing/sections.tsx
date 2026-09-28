import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PhoneFrame, BrowserFrame } from "@/components/landing/frames";
import { CountOnView } from "@/components/landing/CountOnView";
import { Reveal } from "@/components/landing/Reveal";
import { MarketOverview } from "@/components/MarketOverview";
import { LazyMount } from "@/components/landing/LazyMount";
import { DEMO_START_BALANCE, SUBSCRIPTION_FEE_TEXT, TRADABLE_SYMBOL_COUNT } from "@/config/platform";

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

type T = Awaited<ReturnType<typeof getTranslations>>;

// ---------------------------------------------------------------- hero ----

const IMG = "/images/product";

export async function Hero({ videoSrc }: { videoSrc: string | null }) {
  const t = await getTranslations("Landing");
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-0" />
      <div className={`${wrap} relative pb-16 pt-12 md:pb-24 md:pt-20`}>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <div className="flex flex-col items-start gap-6">
            <h1 className="landing-h1 max-w-xl">{t("heroTitle")}</h1>
            <p className="max-w-lg text-base leading-7 text-muted">{t("heroDesc")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-xl bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover">
                {t("heroStart")}
              </Link>
              <a href="#traders" className="rounded-xl border border-border-strong px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface">
                {t("heroBrowse")}
              </a>
            </div>
            <ul className="flex flex-wrap items-center gap-y-1 text-sm text-muted">
              {[t("trust1"), t("trust2"), t("trust3")].map((s) => (
                <li key={s} className="after:mx-3 after:text-text-3 after:content-['·'] last:after:hidden">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile: a single phone under the buttons. */}
          <div className="flex justify-center lg:hidden">
            <PhoneFrame src={`${IMG}/mobile-dashboard.webp`} alt={t("altDashboardMobile")} width={260} priority sizes="260px" videoSrc={videoSrc} />
          </div>

          {/* Desktop: browser window with a phone overlapping its lower edge. */}
          <div className="relative hidden pb-16 lg:block">
            <BrowserFrame src={`${IMG}/desktop-dashboard.webp`} alt={t("altDashboardDesktop")} priority sizes="620px" />
            <div className="absolute -bottom-2 start-6">
              <PhoneFrame src={`${IMG}/mobile-trader.webp`} alt={t("altTraderMobile")} width={190} priority sizes="190px" videoSrc={videoSrc} className="bg-background" />
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted lg:text-start">{t("demoShotNote")}</p>
      </div>
    </section>
  );
}

// One showcase row: text on one side, a product screenshot on the other. The
// image side alternates from row to row; on mobile the image sits under the text.
export function ShowcaseRow({
  id,
  title,
  desc,
  flip = false,
  children,
}: {
  id?: string;
  title: string;
  desc: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className={`flex flex-col gap-4 ${flip ? "md:order-2" : ""}`}>
          <h2 className="landing-h2">{title}</h2>
          <p className="max-w-lg text-base leading-7 text-muted">{desc}</p>
        </div>
        <div className={`flex justify-center ${flip ? "md:order-1" : ""}`}>{children}</div>
      </Reveal>
    </section>
  );
}

// --------------------------------------------------------------- facts ----

export async function FactsStrip({ minCopy }: { minCopy: number | null }) {
  const t = await getTranslations("Landing");
  const facts: { value: string; label: string; ltr: boolean; count?: number }[] = [
    { value: String(TRADABLE_SYMBOL_COUNT), label: t("factMarketsLabel"), ltr: true },
    ...(minCopy != null ? [{ value: `$${minCopy.toLocaleString("en-US")}`, label: t("factMinLabel"), ltr: true }] : []),
    // TODO(owner): SUBSCRIPTION_FEE_TEXT (config/platform.ts) is not defined yet; the fact is hidden until it is.
    ...(SUBSCRIPTION_FEE_TEXT ? [{ value: SUBSCRIPTION_FEE_TEXT, label: t("factFeeLabel"), ltr: true }] : []),
    { value: `$${DEMO_START_BALANCE.toLocaleString("en-US")}`, label: t("factDemoLabel"), ltr: true, count: DEMO_START_BALANCE },
    { value: t("factSignupValue"), label: t("factSignupLabel"), ltr: false },
  ];
  return (
    <section className="border-y border-border">
      <dl className={`${wrap} grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4`}>
        {facts.slice(0, 4).map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <dd className={`text-2xl font-semibold ${f.ltr ? "num" : ""}`}>
              {f.count != null ? <CountOnView value={f.count} prefix="$" /> : f.value}
            </dd>
            <dt className="text-sm text-muted">{f.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------- traders ----

export async function SectionHeading({ id, title, action }: { id?: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div id={id} className="flex scroll-mt-24 items-end justify-between gap-4">
      <h2 className="landing-h2">{title}</h2>
      {action && (
        <Link href={action.href} className="shrink-0 text-sm text-muted transition-colors hover:text-foreground">
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------- how it works ----

export async function HowItWorks() {
  const t = await getTranslations("Landing");
  const steps = [
    { n: "1", title: t("how1t"), desc: t("how1d"), img: "mobile-dashboard", alt: t("altDashboardMobile") },
    { n: "2", title: t("how2t"), desc: t("how2d"), img: "mobile-trader", alt: t("altTraderMobile") },
    { n: "3", title: t("how3t"), desc: t("how3d"), img: "mobile-copy-dialog", alt: t("altCopyDialog") },
  ];
  return (
    <section id="how-it-works" className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="flex flex-col gap-10">
        <SectionHeading title={t("howTitle")} />
        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-6 border-t border-border pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-3">
                  <span className="num text-5xl font-semibold text-text-3">{s.n}</span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-base leading-7 text-muted">{s.desc}</p>
                </div>
              </div>
              <PhoneFrame src={`${IMG}/${s.img}.webp`} alt={s.alt} width={150} crop sizes="150px" className="self-start" />
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

// ------------------------------------------------------------ protection ----

export async function Protection() {
  const t = await getTranslations("Landing");
  // "Coming soon" marks the settings the copy dialog does not enable yet.
  const points = [
    { text: t("protect1"), soon: false },
    { text: t("protect2"), soon: true },
    { text: t("protect3"), soon: true },
    { text: t("protect4"), soon: false },
  ];
  const soon = <span className="ms-2 rounded-md border border-border-strong px-1.5 py-0.5 align-middle text-xs text-muted">{t("soon")}</span>;
  return (
    <section className="border-y border-border bg-surface/40">
      <div className={`${wrap} landing-section`}>
        <Reveal className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-6">
            <h2 className="landing-h2">{t("protectTitle")}</h2>
            <p className="text-base leading-7 text-muted">{t("protectIntro")}</p>
            <ul className="flex flex-col gap-4">
              {points.map((p) => (
                <li key={p.text} className="border-s-2 border-border-strong ps-4 text-base">
                  {p.text}
                  {p.soon && soon}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <PhoneFrame src={`${IMG}/mobile-copy-dialog.webp`} alt={t("altCopyDialog")} width={280} sizes="280px" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- follow trades ----

export async function FollowTrades() {
  const t = await getTranslations("Landing");
  return (
    <ShowcaseRow title={t("followTitle")} desc={t("followDesc")} flip>
      <div className="flex items-start justify-center gap-4">
        <PhoneFrame src={`${IMG}/mobile-trades-open.webp`} alt={t("altTradesMobile")} width={190} sizes="190px" />
        <PhoneFrame src={`${IMG}/mobile-copies.webp`} alt={t("altCopiesMobile")} width={190} sizes="190px" className="mt-10" />
      </div>
    </ShowcaseRow>
  );
}

// ---------------------------------------------------------- transparency ----

export async function Transparency() {
  const t = await getTranslations("Landing");
  // TODO(owner): column 1 states only what the landing query enforces. Replace
  // with the platform's real trader-acceptance criteria if they are stricter.
  const cols = [
    { title: t("transp1t"), desc: t("transp1d") },
    { title: t("transp2t"), desc: t("transp2d") },
    { title: t("transp3t"), desc: t("transp3d") },
  ];
  return (
    <section className={`${wrap} landing-section`}>
      <Reveal className="flex flex-col gap-10">
        <SectionHeading title={t("transpTitle")} />
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {cols.map((c) => (
            <div key={c.title} className="flex flex-col gap-3 border-t border-border pt-6">
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="text-base leading-7 text-muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ------------------------------------------------------------------ fees ----

export async function Fees() {
  const t = await getTranslations("Landing");
  // TODO(owner): only values that exist today are listed. Add the subscription
  // fee (config/platform.ts SUBSCRIPTION_FEE_TEXT) and any other charges here.
  const pay = [
    ...(SUBSCRIPTION_FEE_TEXT ? [`${t("factFeeLabel")}: ${SUBSCRIPTION_FEE_TEXT}`] : []),
    t("feePay1"),
    t("feePay2"),
  ];
  const notPay = [t("feeNot1")];
  return (
    <section id="fees" className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="flex flex-col gap-8">
        <SectionHeading title={t("feesTitle")} />
        <div className="grid overflow-hidden rounded-2xl border border-border md:grid-cols-2">
          <div className="border-b border-border p-6 md:border-b-0 md:border-e">
            <h3 className="mb-4 text-lg font-semibold">{t("feesPay")}</h3>
            <ul className="flex flex-col gap-3 text-base leading-7 text-muted">
              {pay.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="p-6">
            <h3 className="mb-4 text-lg font-semibold">{t("feesNotPay")}</h3>
            <ul className="flex flex-col gap-3 text-base leading-7 text-muted">
              {notPay.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-sm text-muted">{t("feesNote")}</p>
      </Reveal>
    </section>
  );
}

// ------------------------------------------------------------------ demo ----

export async function DemoSection() {
  const t = await getTranslations("Landing");
  return (
    <section className="border-y border-border">
      <div className={`${wrap} flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center`}>
        <div className="flex max-w-xl flex-col gap-2">
          <h2 className="text-2xl font-semibold">{t("demoTitle")}</h2>
          <p className="text-base leading-7 text-muted">{t("demoDesc", { amount: `$${DEMO_START_BALANCE.toLocaleString("en-US")}` })}</p>
        </div>
        <Link href="/signup" className="shrink-0 rounded-xl border border-border-strong px-6 py-3 text-base font-medium transition-colors hover:bg-surface">
          {t("demoCta")}
        </Link>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- markets ----

export async function Markets() {
  const t = await getTranslations("Landing");
  return (
    <section id="markets" className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="flex flex-col gap-6">
        <SectionHeading title={t("marketsTitle")} action={{ href: "/markets", label: t("marketsViewAll") }} />
        <p className="-mt-3 text-base text-muted">{t("marketsDesc")}</p>
        <div className="overflow-hidden rounded-2xl border border-border">
          <LazyMount minHeight={420}>
            <MarketOverview />
          </LazyMount>
        </div>
      </Reveal>
    </section>
  );
}

// ------------------------------------------------------------------- faq ----

export async function Faq({ minCopy }: { minCopy: number | null }) {
  const t = await getTranslations("Landing");
  const demo = `$${DEMO_START_BALANCE.toLocaleString("en-US")}`;
  const items = [
    { q: t("faq1q"), a: t("faq1a") },
    { q: t("faq2q"), a: t("faq2a") },
    { q: t("faq3q"), a: minCopy != null ? t("faq3a", { amount: `$${minCopy.toLocaleString("en-US")}` }) : t("faq3aNoAmount") },
    { q: t("faq4q"), a: t("faq4a") },
    { q: t("faq5q"), a: t("faq5a") },
    { q: t("faq6q"), a: t("faq6a") },
    { q: t("faq7q"), a: t("faq7a") },
    { q: t("faq8q"), a: t("faq8a", { amount: demo }) },
  ];
  return (
    <section id="faq" className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="mx-auto flex max-w-3xl flex-col gap-8">
        <SectionHeading title={t("faqTitle")} />
        <div className="border-t border-border">
          {items.map((it) => (
            <details key={it.q} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium [&::-webkit-details-marker]:hidden">
                {it.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
              </summary>
              <p className="pb-5 text-base leading-7 text-muted">{it.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ------------------------------------------------------------- final cta ----

export async function FinalCta() {
  const t = await getTranslations("Landing");
  return (
    <section className={`${wrap} landing-section`}>
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
        <h2 className="landing-h2">{t("ctaTitle")}</h2>
        <p className="max-w-md text-base leading-7 text-muted">{t("ctaDesc")}</p>
        <Link href="/signup" className="rounded-xl bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover">
          {t("heroStart")}
        </Link>
      </div>
    </section>
  );
}
