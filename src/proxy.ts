import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/avatar/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
