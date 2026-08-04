import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, changePassword } from "@/app/settings/actions";
import { AppNav } from "@/components/AppNav";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">الإعدادات</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            تم الحفظ بنجاح.
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">الملف الشخصي</h2>
          <p className="text-xs text-muted">{user.email}</p>
          <form action={updateProfile} className="flex flex-col gap-3">
            <input
              name="displayName"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              placeholder="الاسم الكامل"
              required
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              حفظ الاسم
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">تغيير كلمة المرور</h2>
          <form action={changePassword} className="flex flex-col gap-3">
            <input
              name="password"
              type="password"
              placeholder="كلمة المرور الجديدة (٦ أحرف على الأقل)"
              required
              minLength={6}
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              تحديث كلمة المرور
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
