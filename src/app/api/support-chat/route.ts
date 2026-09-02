import { NextResponse } from "next/server";
import { matchFaq, SUPPORT_FAQ } from "@/lib/support-faq";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `أنت مساعد الدعم الفني لمنصة "Copy Matrix"، وهي منصة تجريبية/محاكاة لنسخ صفقات التداول تلقائيًا (وليست منصة وساطة حقيقية أو مرخصة). أجب بالعربية، بإيجاز ووضوح (٣-٤ جمل كحد أقصى)، وبأسلوب ودود ومباشر.
- لا تقدّم أي نصيحة استثمارية أو مالية حقيقية، ولا تتوقع حركة الأسواق.
- إذا سُئلت عن كون المنصة حقيقية: وضّح بلطف أنها بيئة تجريبية لأغراض العرض والتجربة.
- إذا لم تكن متأكدًا من إجابة تخص حساب المستخدم تحديدًا (رصيد، معاملة معينة)، وجّهه للتواصل مع الدعم البشري عبر البريد الإلكتروني بدل التخمين.
- لا تطلب من المستخدم كلمة المرور أو أي بيانات حساسة أبدًا.`;

async function callAiFallback(message: string, history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "هذا السؤال يحتاج متابعة من فريق الدعم البشري مباشرة. تقدر تتواصل معنا عبر البريد الإلكتروني support@copy-matrix.test وهنرد عليك في أقرب وقت.";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [...history.slice(-6), { role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    return "حصل خطأ مؤقت في خدمة الدعم الذكي. جرّب تاني بعد لحظات، أو تواصل معنا عبر support@copy-matrix.test.";
  }

  const data = await res.json();
  const text = data?.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text;
  return typeof text === "string" && text.trim() ? text.trim() : "معنديش إجابة واضحة على السؤال ده دلوقتي — جرّب تصيغه بشكل مختلف أو تواصل مع الدعم.";
}

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.filter(
        (m): m is ChatMessage =>
          typeof m === "object" && m !== null && (m as ChatMessage).role !== undefined && typeof (m as ChatMessage).content === "string",
      )
    : [];

  const faqMatch = matchFaq(message);
  if (faqMatch) {
    return NextResponse.json({ reply: faqMatch.answer, source: "faq" });
  }

  const reply = await callAiFallback(message, history);
  return NextResponse.json({ reply, source: "ai" });
}

export async function GET() {
  return NextResponse.json({ suggestions: SUPPORT_FAQ.slice(0, 4).map((f) => ({ id: f.id, question: f.question })) });
}
