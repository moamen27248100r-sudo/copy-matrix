const KNOWN_ERRORS: [string, string][] = [
  ["Invalid login credentials", "البريد الإلكتروني أو كلمة المرور غير صحيحة."],
  ["Email not confirmed", "لم يتم تأكيد البريد الإلكتروني بعد. يرجى فتح رابط التأكيد المرسل إليك."],
  ["User already registered", "هذا البريد الإلكتروني مسجَّل بالفعل. يرجى تسجيل الدخول."],
  ["Password should be at least", "كلمة المرور يجب أن تتكوّن من ٦ أحرف على الأقل."],
  ["is invalid", "البريد الإلكتروني المُدخل غير صالح."],
  ["only request this after", "يرجى الانتظار قليلًا قبل إعادة المحاولة."],
];

export function translateAuthError(message: string): string {
  const match = KNOWN_ERRORS.find(([needle]) => message.includes(needle));
  return match ? match[1] : "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
}
