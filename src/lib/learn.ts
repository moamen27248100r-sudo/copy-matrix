// The short in-platform articles ("Learn"). The text lives in the translations (Learn.<slug>.*);
// this is only the list, in the order they are shown.
export const LEARN_ARTICLES = ["how_copy_works", "choose_trader", "risk_management", "demo_vs_real"] as const;
export type LearnSlug = (typeof LEARN_ARTICLES)[number];
export const isLearnSlug = (v: string): v is LearnSlug => (LEARN_ARTICLES as readonly string[]).includes(v);
