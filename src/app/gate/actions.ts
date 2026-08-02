"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function unlockSite(formData: FormData) {
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/";

  if (password !== process.env.SITE_ACCESS_PASSWORD) {
    redirect(`/gate?error=1&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("site_access", "granted", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next);
}
