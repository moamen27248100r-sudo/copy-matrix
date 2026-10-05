# ضبط الإيميلات في Copy Matrix

المنصة فيها نوعين من الإيميلات، والاتنين بيستخدموا **نفس خدمة الإيميل (SMTP)**:

| النوع | مين بيبعته | أمثلة |
|---|---|---|
| إيميلات المنصة | التطبيق نفسه (`/api/cron/emails`) | نسخ صفقة وإغلاقها، إيقاف النسخ، الإيداع والسحب، التحقق من الهوية، تغيير كلمة السر أو المصادقة الثنائية، طلب سحب |
| إيميلات تسجيل الدخول | Supabase Auth | تأكيد التسجيل، استعادة كلمة السر |

لحد ما تضيف بيانات الخدمة، إيميلات المنصة **ما بتتبعتش خالص** (لا أخطاء ولا تراكم). وأي إيميل يعدّي عليه أكتر من 24 ساعة من غير إرسال بيتلغي، فمش هيوصل للعميل إيميلات قديمة دفعة واحدة لما تفعّل الخدمة.

---

## 1. اختار خدمة إيميل

أي خدمة بتدّي SMTP تنفع. الأسهل:

- **Resend** (مقترحة): السيرفر `smtp.resend.com`، المنفذ `465`، اسم المستخدم `resend`، وكلمة السر هي الـ API key.
- **Brevo**: السيرفر `smtp-relay.brevo.com`، المنفذ `587`، واسم المستخدم وكلمة السر من صفحة SMTP في حسابك.

## 2. وثّق الدومين بتاعك

في لوحة الخدمة، أضف الدومين (مثلاً `copymatrix.com`)، وانسخ سجلات DNS اللي هتظهرلك (**SPF** و**DKIM**، ويفضّل **DMARC**) للمكان اللي بتدير منه الدومين. من غير السجلات دي، الإيميلات هتروح السبام.

استخدم عنوان إرسال على نفس الدومين، مثلاً: `Copy Matrix <no-reply@copymatrix.com>`.

## 3. إيميلات المنصة (Vercel)

في Vercel، افتح **Project → Settings → Environment Variables** وأضف:

| المتغيّر | القيمة |
|---|---|
| `SUPPORT_EMAIL_HOST` | سيرفر SMTP، مثلاً `smtp.resend.com` |
| `SUPPORT_EMAIL_PORT` | `465` أو `587` |
| `SUPPORT_EMAIL_USER` | اسم مستخدم SMTP |
| `SUPPORT_EMAIL_PASS` | كلمة سر SMTP أو الـ API key |
| `SUPPORT_EMAIL_FROM` | `Copy Matrix <no-reply@copymatrix.com>` |
| `CRON_SECRET` | نص عشوائي طويل (لو مش موجود أصلاً) |
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع، مثلاً `https://copymatrix.com` |

بعد كده اعمل **Redeploy**.

## 4. شغّل الإرسال الدوري (Supabase)

قاعدة البيانات بتنادي رابط الإرسال كل دقيقة، طالما فيه إيميلات منتظرة. شغّل الأمر ده مرة واحدة من **SQL Editor** في Supabase، وحط قيمك مكان القيم دي:

```sql
select vault.create_secret('https://copymatrix.com/api/cron/emails', 'email_cron_url');
-- نفس قيمة CRON_SECRET في Vercel؛ لو موجودة من قبل (بتاعة الإيداعات) تخطّى السطر ده
select vault.create_secret('ضع-هنا-قيمة-CRON_SECRET', 'crypto_cron_secret');
```

## 5. إيميلات تسجيل الدخول (Supabase Auth)

### أ. اربط SMTP
افتح **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**، وفعّل **Enable Custom SMTP**، وأدخل نفس بيانات الخطوة 3:
- Sender email: `no-reply@copymatrix.com`
- Sender name: `Copy Matrix`
- Host / Port / Username / Password

الإيميل الافتراضي بتاع Supabase محدود بعدد صغير جداً من الرسايل في الساعة، ومش مناسب للإطلاق. بعد الربط، افتح **Authentication → Rate Limits** وارفع حد الإيميلات في الساعة حسب حاجتك.

### ب. الصق القوالب
افتح **Authentication → Emails → Templates**:

| القالب | Subject | Body |
|---|---|---|
| **Confirm signup** | `تأكيد بريدك الإلكتروني \| Confirm your email` | محتوى `supabase/templates/confirmation.html` كله |
| **Reset password** | `إعادة تعيين كلمة المرور \| Reset your password` | محتوى `supabase/templates/recovery.html` كله |

القوالب بتختار لغة العميل تلقائياً من الـ 13 لغة: اللغة اللي سجّل بيها، أو آخر لغة اختارها في المنصة. لو مش معروفة، بتظهر بالعربي. سطر الـ Subject مش بيتغيّر حسب اللغة في Supabase، عشان كده هو بالعربي والإنجليزي. الترجمات الكاملة موجودة في `supabase/templates/subjects.txt`.

قالب استعادة كلمة السر بيعرض **كود من 6 أرقام** (`{{ .Token }}`)، والمنصة بتطلبه في صفحة "أدخل الكود"، ومعاه زرار للرابط. ما تشيلش الكود من القالب.

### ج. الروابط
في **Authentication → URL Configuration**:
- Site URL: `https://copymatrix.com`
- Redirect URLs: أضف `https://copymatrix.com/auth/confirm` و`https://copymatrix.com/auth/callback`

## 6. جرّب

1. سجّل حساب جديد: لازم يوصلك إيميل التأكيد بلغة الموقع.
2. اطلب استعادة كلمة السر: لازم يوصلك الكود.
3. على حساب حقيقي، انسخ متداول واستنى صفقة تتقفل: لازم يوصلك إيميل "تم إغلاق الصفقة".
4. تابع حالة الإيميلات من SQL Editor:

```sql
select kind, status, last_error, created_at, sent_at from public.email_outbox order by id desc limit 20;
```

`sent` يعني اتبعت، و`failed` معناها راجع الخطأ في `last_error` (غالباً بيانات SMTP)، و`skipped` يعني إما SMTP مش متضبوط أو الإيميل قديم.

## تعديل الترجمات أو شكل القوالب

- نصوص إيميلات المنصة موجودة في `src/messages/*.json` تحت `Email` و`Notifications`.
- نصوص قوالب Supabase موجودة تحت `AuthEmail`. بعد أي تعديل، شغّل الأمر ده والصق القوالب تاني في Supabase:

```bash
node scripts/build-auth-email-templates.mjs
```

## إعدادات العميل

من **الإشعارات ← الإعدادات** العميل يقدر يتحكم في كل نوع (الصفقات، النسخ، الحساب) **داخل المنصة** و**بالإيميل** كل واحد لوحده. إيميلات الأمان ما ينفعش تتقفل. صفقات الحساب التجريبي ما بيتبعتلهاش إيميلات، زي المنصات الاحترافية.
