"use client";

import { useEffect, useState } from "react";

// Deterministic pseudo-random hash of a seed, in [0, 1) — NOT Math.random().
// Every LiveCounter instance on the page computes the same drift for the
// same (base, time bucket), so two mounted copies of the same stat always
// show the identical number at any given moment instead of drifting apart
// independently.
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

const BUCKET_MS = 4000;
const POLL_MS = 1000;

function liveValue(base: number) {
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const r1 = seededRandom(bucket * 12.9898 + base * 78.233);
  const r2 = seededRandom(bucket * 39.346 + base * 11.135);
  // Two independent-looking waves combined so the swing doesn't read as one
  // clean, predictable oscillation — organic-feeling movement, not a
  // mechanical bounce between two fixed endpoints.
  const drift = (r1 - 0.5) * 0.16 + (r2 - 0.5) * 0.08;
  return Math.max(1, Math.round(base * (1 + drift)));
}

export function LiveCounter({
  base,
  suffix = "",
  className,
}: {
  base: number;
  suffix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(() => liveValue(base));

  useEffect(() => {
    setValue(liveValue(base));
    const id = setInterval(() => setValue(liveValue(base)), POLL_MS);
    return () => clearInterval(id);
  }, [base]);

  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      {value.toLocaleString("en-US")}
      {suffix}
    </p>
  );
}
