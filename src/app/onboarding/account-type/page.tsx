import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseAccountType } from "@/app/auth/actions";

const OPTIONS = [
  {
    value: "demo",
    title: "حساب تجريبي",
    desc: "تدرّب على نسخ الصفقات بأموال افتراضية دون أي مخاطرة، وتعرّف على المنصة قبل استخدام أموالك الحقيقية.",
    icon: (
      <>
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  {
    value: "real",
    title: "حساب حقيقي",
    desc: "ابدأ بنسخ الصفقات برصيدك الفعلي، وتُطبَّق عليه كل نتائج النسخ الحقيقية من أرباح أو خسائر.",
    icon: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
  },
];

export default async function ChooseAccountTypePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">اختر نوع حسابك</h1>
        <p className="text-sm text-muted">يمكنك تغيير هذا الاختيار لاحقًا من الإعدادات في أي وقت.</p>
      </div>

      <div className="flex flex-col gap-4">
        {OPTIONS.map((opt) => (
          <form key={opt.value} action={chooseAccountType}>
            <input type="hidden" name="accountType" value={opt.value} />
            <button
              type="submit"
              className="flex w-full items-start gap-4 rounded-xl border border-border bg-surface p-5 text-start transition hover:border-accent/50 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {opt.icon}
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-medium">{opt.title}</p>
                <p className="text-sm leading-relaxed text-muted">{opt.desc}</p>
              </div>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
