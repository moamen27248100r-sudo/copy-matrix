import { NextResponse } from "next/server";
import { matchFaq, SUPPORT_FAQ } from "@/lib/support-faq";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `أنت المساعد الرسمي لخدمة الدعم الفني في منصة "Copy Matrix"، وهي منصة تجريبية/محاكاة لنسخ صفقات التداول تلقائيًا (وليست منصة وساطة حقيقية أو مرخصة). أجب دائمًا باللغة العربية الفصحى الرسمية، بأسلوب احترافي ومهذّب يليق بمنصات التداول العالمية، وبإيجاز ووضوح (٣-٤ جمل كحد أقصى)، مع تجنّب أي لهجة عامية تمامًا.
- لا تقدّم أي نصيحة استثمارية أو مالية حقيقية، ولا تتنبأ بحركة الأسواق.
- إذا سُئلت عن كون المنصة حقيقية، وضّح بأسلوب مهذّب أنها بيئة تجريبية مخصصة لأغراض العرض والتجربة.
- إذا لم تكن متأكدًا من إجابة تخص حساب المستخدم تحديدًا (كالرصيد أو معاملة معينة)، وجّهه للتواصل مع فريق الدعم البشري عبر البريد الإلكتروني بدلًا من التخمين.
- لا تطلب من المستخدم كلمة المرور أو أي بيانات حساسة أبدًا.`;

async function callAiFallback(message: string, history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "يتطلب هذا الاستفسار متابعة مباشرة من فريق الدعم الفني المختص. يُرجى التواصل معنا عبر البريد الإلكتروني support@copy-matrix.test، وسيتم الرد عليكم في أقرب وقت ممكن.";
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
    return "عذرًا، حدث خطأ مؤقت في خدمة الدعم الذكي. يُرجى المحاولة مرة أخرى بعد قليل، أو التواصل معنا عبر support@copy-matrix.test.";
  }

  const data = await res.json();
  const text = data?.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text;
  return typeof text === "string" && text.trim()
    ? text.trim()
    : "لا تتوفر لدينا إجابة واضحة على هذا الاستفسار حاليًا. يُرجى إعادة صياغته بشكل مختلف أو التواصل مع فريق الدعم.";
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
