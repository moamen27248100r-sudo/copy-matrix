// Only allow same-origin relative paths (never "//host/..." or "https://...")
// so a "next" query param can never be turned into an open redirect.
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
