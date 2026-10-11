// Where to send a visitor who asked for a Discover page that has no rows
// (a stale bookmark, a hand-typed ?page=). null = nothing to correct.
//   * a page past the end            -> the last page, when the total is known
//   * a page the database could not
//     count (total 0)                -> the first page
// Every other query parameter is kept; `error` and `page` are not.
export function emptyPageTarget(
  params: Record<string, string | string[] | undefined>,
  page: number,
  shownCount: number,
  total: number,
  perPage: number,
): string | null {
  if (page <= 1 || shownCount > 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && k !== "page" && k !== "error") sp.set(k, v);
  }
  if (total > 0 && pageCount > 1) sp.set("page", String(pageCount));
  const qs = sp.toString();
  return qs ? `/discover?${qs}` : "/discover";
}
