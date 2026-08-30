import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, updateAccountType, changePassword } from "@/app/settings/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";

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
    .select("display_name, account_type")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
        <BackButton fallbackHref="/dashboard" />
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
          <h2 className="font-medium">نوع الحساب</h2>
          <p className="text-xs text-muted">
            الحساب الحقيقي يتيح إيداع وسحب أموال فعلية. الحساب التجريبي مخصص للتدريب والاستكشاف برصيد وهمي فقط.
            التبديل بين النوعين يعيد ضبط رصيدك (تجريبي: 1,000$، حقيقي: 0$).
          </p>
          <form action={updateAccountType} className="flex flex-col gap-2">
            <label
              className={
                (profile?.account_type ?? "demo") === "demo"
                  ? "flex items-center gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input
                type="radio"
                name="accountType"
                value="demo"
                defaultChecked={(profile?.account_type ?? "demo") === "demo"}
              />
              <span className="font-semibold text-warning">حساب تجريبي</span>
              <span className="text-xs text-muted">— للتدريب والاستكشاف</span>
            </label>
            <label
              className={
                profile?.account_type === "real"
                  ? "flex items-center gap-2 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input type="radio" name="accountType" value="real" defaultChecked={profile?.account_type === "real"} />
              <span className="font-semibold text-success">حساب حقيقي</span>
              <span className="text-xs text-muted">— إيداع وسحب أموال فعلية</span>
            </label>
            <button
              type="submit"
              className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              حفظ نوع الحساب
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
