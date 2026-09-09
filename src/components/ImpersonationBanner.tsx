import { cookies } from "next/headers";
import { returnToAdmin } from "@/app/admin/actions";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (!raw) return null;

  let adminEmail: string | null = null;
  try {
    adminEmail = (JSON.parse(raw) as { admin_email?: string }).admin_email ?? null;
  } catch {
    return null;
  }

  return (
    <div className="sticky top-0 z-[10000] flex flex-wrap items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-sm font-medium text-background">
      <span>
        أنت تتصفح الآن كحساب عميل{adminEmail ? ` — الأدمن: ${adminEmail}` : ""}. أي إجراء تنفّذه هيتم باسم هذا العميل.
      </span>
      <form action={returnToAdmin}>
        <button type="submit" className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-warning">
          العودة لحساب الأدمن
        </button>
      </form>
    </div>
  );
}
