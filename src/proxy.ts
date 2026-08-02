import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const GATE_COOKIE = "site_access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/gate") {
    return await updateSession(request);
  }

  const expected = process.env.SITE_ACCESS_PASSWORD;
  const cookieValue = request.cookies.get(GATE_COOKIE)?.value;

  if (expected && cookieValue !== "granted") {
    const url = request.nextUrl.clone();
    url.pathname = "/gate";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
