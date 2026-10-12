// One-shot messages are passed through the URL (?error=…, ?success=…) by server-action redirects. Once the page
// has shown them they must not survive a reload, so the viewer is shown the same address without them.
const FLASH_KEYS = ["error", "success"];

/** The path + query with the flash params removed, or null when there is nothing to remove. */
export function withoutFlashParams(pathname: string, search: string, hash = ""): string | null {
  const params = new URLSearchParams(search);
  if (!FLASH_KEYS.some((k) => params.has(k))) return null;
  for (const k of FLASH_KEYS) params.delete(k);
  const qs = params.toString();
  return pathname + (qs ? `?${qs}` : "") + hash;
}
