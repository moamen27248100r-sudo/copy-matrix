import { getTranslations } from "next-intl/server";
import { IPhoneFrame, LaptopFrame } from "@/components/mockup/DeviceFrames";
import { ScaledCanvas } from "@/components/mockup/ScaledCanvas";
import { HeroDevices } from "@/components/mockup/HeroDevices";
import { LazyReveal } from "@/components/mockup/LazyReveal";
import { CopyScreen, DashboardScreen, DiscoverScreen, LAPTOP, MarketsScreen, PHONE, ProfileScreen, WalletScreen } from "@/components/mockup/Screens";

// What the public home page shows instead of a picture: the platform's own screens, drawn inside a
// phone and a laptop frame made in code. See Screens.tsx and src/data/mockup-fixtures.ts.

function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <IPhoneFrame className={className}>
      <ScaledCanvas width={PHONE.width} height={PHONE.height}>
        {children}
      </ScaledCanvas>
    </IPhoneFrame>
  );
}

/** The hero: the wallet on a phone in front of the desktop dashboard on a laptop. */
export async function HeroMockup() {
  const t = await getTranslations("Home.mockup");
  const td = await getTranslations("HomeShowcase");
  return (
    <section className="relative w-full px-3 py-4 md:py-8 lg:py-0">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%)", filter: "blur(90px)" }}
      />
      <HeroDevices
        label={t("heroAria")}
        phone={
          <Phone>
            <WalletScreen />
          </Phone>
        }
        laptop={
          <LaptopFrame>
            <ScaledCanvas width={LAPTOP.width} height={LAPTOP.height}>
              <DashboardScreen />
            </ScaledCanvas>
          </LaptopFrame>
        }
      />
      <p className="mx-auto mt-4 max-w-sm text-center text-[11px] text-muted md:mt-6">{td("disclaimer")}</p>
    </section>
  );
}

const FEATURES = [
  { key: "discover", Screen: DiscoverScreen },
  { key: "profile", Screen: ProfileScreen },
  { key: "copy", Screen: CopyScreen },
  { key: "markets", Screen: MarketsScreen },
] as const;

/** Four feature rows: a title and a short text beside one phone, alternating sides. */
export async function FeatureMockups() {
  const t = await getTranslations("Home.mockup");
  return (
    <section className="border-t border-border px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 md:gap-24">
        {FEATURES.map(({ key, Screen }, i) => (
          <div key={key} className={`flex flex-col items-center gap-8 md:gap-14 ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"}`}>
            <div className="flex-1 text-center md:text-start">
              <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t(`${key}Title`)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t(`${key}Desc`)}</p>
            </div>
            <div className="w-[min(260px,70vw)] shrink-0 md:w-[280px]">
              <LazyReveal aspect="390 / 844">
                <Phone className="w-full">
                  <Screen />
                </Phone>
              </LazyReveal>
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-12 max-w-sm text-center text-[11px] text-muted">{(await getTranslations("HomeShowcase"))("disclaimer")}</p>
    </section>
  );
}
