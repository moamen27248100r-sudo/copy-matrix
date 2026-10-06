// Only allow same-origin relative paths (never "//host/..." or "https://...")
// so a "next" query param can never be turned into an open redirect.
// Backslashes and control characters are refused too: browsers treat "/\host"
// and "/<tab>/host" like "//host".
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}
