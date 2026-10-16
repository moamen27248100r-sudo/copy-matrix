// Whether Google sign-in is switched on in the auth project. Asked before sending the browser to
// Google, because a project without it answers with a bare error page. null = could not find out
// (the attempt is then made anyway and any failure is shown on the button).
export function googleFromSettings(settings: unknown): boolean | null {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== "object") return null;
  return external.google === true;
}

export async function isGoogleEnabled(baseUrl: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<boolean | null> {
  try {
    const res = await fetcher(`${baseUrl.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: apiKey }, cache: "no-store" });
    if (!res.ok) return null;
    return googleFromSettings(await res.json());
  } catch {
    return null;
  }
}
