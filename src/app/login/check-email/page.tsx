export default async function LoginCheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">تحقق من بريدك الإلكتروني</h1>
      <p className="text-sm text-muted">
        أرسلنا رابط تسجيل دخول {email ? <>إلى <span className="text-foreground">{email}</span></> : "إلى بريدك"}. افتح
        الرابط من نفس الجهاز لتسجيل الدخول مباشرة، بدون كلمة مرور.
      </p>
    </main>
  );
}
