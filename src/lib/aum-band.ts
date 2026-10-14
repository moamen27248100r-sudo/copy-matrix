// A leader's copied money is only ever shown as a coarse band ("over $100,000"), never the exact
// amount. provider_cards.aum_band (migration 0258) is 0..6 and these are the floors of each band.
export const AUM_BAND_FLOORS = [0, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000] as const;

/** The lower bound of a band, or null for the lowest band (nothing worth showing). */
export function aumBandFloor(band: unknown): number | null {
  const b = Number(band);
  if (!Number.isInteger(b) || b < 1 || b >= AUM_BAND_FLOORS.length) return null;
  return AUM_BAND_FLOORS[b];
}

/** The band that starts at (or just above) an amount, for the "copied money of at least ..." filter. */
export function aumBandAtLeast(amount: number): number {
  const i = AUM_BAND_FLOORS.findIndex((f) => f >= amount);
  return i < 0 ? AUM_BAND_FLOORS.length - 1 : i;
}
