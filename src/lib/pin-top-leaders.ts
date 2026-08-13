// Keeps أنس ريان and يوسف علي pinned at positions #1 and #3 in any
// "highest return" ranked list, regardless of how their computed
// avg_return_pct drifts over time from the live automated simulation —
// a data-driven sort alone can't guarantee a fixed position long-term.
export function pinTopLeaders<T extends { display_name: string | null }>(providers: T[]): T[] {
  const anas = providers.find((p) => p.display_name === "أنس ريان");
  const youssef = providers.find((p) => p.display_name === "يوسف علي");
  if (!anas && !youssef) return providers;

  const rest = providers.filter((p) => p.display_name !== "أنس ريان" && p.display_name !== "يوسف علي");
  const result: T[] = [];
  if (anas) result.push(anas);
  if (rest[0]) result.push(rest[0]);
  if (youssef) result.push(youssef);
  result.push(...rest.slice(1));
  return result;
}
