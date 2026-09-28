import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MiniSpark, pct, type TraderCardData } from "@/components/landing/TradersTabs";
import { Reveal } from "@/components/landing/Reveal";
import { MarketOverview } from "@/components/MarketOverview";
import { DEMO_START_BALANCE, SUBSCRIPTION_FEE_TEXT, TRADABLE_SYMBOL_COUNT } from "@/config/platform";

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

type T = Awaited<ReturnType<typeof getTranslations>>;

// ---------------------------------------------------------------- hero ----

function HeroMockup({ trader, t }: { trader: TraderCardData; t: T }) {
  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold" aria-hidden="true">
            {trader.name.trim()[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{trader.name}</p>
            <p className="truncate text-sm text-muted">
              {trader.countryLabel}
              {trader.countryLabel && trader.marketLabel ? " · " : ""}
              {trader.marketLabel}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <p className={`num text-4xl font-semibold ${trader.ret >= 0 ? "text-up" : "text-down"}`}>{pct(trader.ret)}</p>
          <p className="text-sm text-muted">{t("return12")}</p>
        </div>
        <MiniSpark series={trader.series} className="mt-4 h-28 w-full" />
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted">{t("maxDd")}</dt>
            <dd className="num font-medium">-{trader.dd.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("riskLabel")}</dt>
            <dd className="num font-medium">{trader.risk}/10</dd>
          </div>
          {trader.followers >= 5 && (
            <div>
              <dt className="text-xs text-muted">{t("copiers")}</dt>
              <dd className="num font-medium">{trader.followers.toLocaleString("en-US")}</dd>
            </div>
          )}
        </dl>
        <Link
          href={trader.profileHref}
          className="mt-5 block rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {t("copy")}
        </Link>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-muted">
        {t("mockupCaption")}. {t("pastPerf")}
      </p>
    </div>
  );
}

export async function Hero({ trader }: { trader: TraderCardData | null }) {
  const t = await getTranslations("Landing");
  return (
    <section className={`${wrap} pt-32 pb-16 md:pt-40 md:pb-24`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {[t("trust1"), t("trust2"), t("trust3")].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="text-text-3">·</span>}
                {s}
              </li>
            ))}
          </ul>
        </div>
        {trader && <HeroMockup trader={trader} t={t} />}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- facts ----

export async function FactsStrip({ minCopy }: { minCopy: number | null }) {
  const t = await getTranslations("Landing");
  const facts: { value: string; label: string; ltr: boolean }[] = [
    { value: String(TRADABLE_SYMBOL_COUNT), label: t("factMarketsLabel"), ltr: true },
    ...(minCopy != null ? [{ value: `$${minCopy.toLocaleString("en-US")}`, label: t("factMinLabel"), ltr: true }] : []),
    // TODO(owner): SUBSCRIPTION_FEE_TEXT (config/platform.ts) is not defined yet; the fact is hidden until it is.
    ...(SUBSCRIPTION_FEE_TEXT ? [{ value: SUBSCRIPTION_FEE_TEXT, label: t("factFeeLabel"), ltr: true }] : []),
    { value: `$${DEMO_START_BALANCE.toLocaleString("en-US")}`, label: t("factDemoLabel"), ltr: true },
    { value: t("factSignupValue"), label: t("factSignupLabel"), ltr: false },
  ];
  return (
    <section className="border-y border-border">
      <dl className={`${wrap} grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4`}>
        {facts.slice(0, 4).map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <dd className={`text-2xl font-semibold ${f.ltr ? "num" : ""}`}>{f.value}</dd>
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
    { n: "1", title: t("how1t"), desc: t("how1d") },
    { n: "2", title: t("how2t"), desc: t("how2d") },
    { n: "3", title: t("how3t"), desc: t("how3d") },
  ];
  return (
    <section id="how-it-works" className={`${wrap} landing-section scroll-mt-16`}>
      <Reveal className="flex flex-col gap-10">
        <SectionHeading title={t("howTitle")} />
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-3 border-t border-border pt-6">
              <span className="num text-5xl font-semibold text-text-3">{s.n}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-base leading-7 text-muted">{s.desc}</p>
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
  const row = "flex items-center justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0";
  return (
    <section className="border-y border-border bg-surface/40">
      <div className={`${wrap} landing-section`}>
        <Reveal className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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

          {/* Static, non-interactive picture of the copy-settings dialog. */}
          <div aria-hidden="true" className="mx-auto w-full max-w-[420px] select-none">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-2 text-base font-semibold">{t("mockTitle")}</p>
              <div>
                <div className={row}>
                  <span className="text-muted">{t("mockAmount")}</span>
                  <span className="num font-medium">$1,000</span>
                </div>
                <div className={row}>
                  <span className="text-muted">{t("mockLossLimit")}</span>
                  <span className="num font-medium">20%</span>
                </div>
                <div className={row}>
                  <span className="text-muted">{t("mockMaxTrade")}</span>
                  <span className="num font-medium">$200</span>
                </div>
                <div className={row}>
                  <span className="text-muted">{t("mockMode")}</span>
                  <span className="font-medium">{t("mockModeNew")}</span>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border-strong py-2.5 text-center text-sm text-muted">{t("mockStop")}</div>
            </div>
            <p className="mt-3 text-center text-xs text-muted">{t("mockNote")}</p>
          </div>
        </Reveal>
      </div>
    </section>
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
          <MarketOverview />
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
