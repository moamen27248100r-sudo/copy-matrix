import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { matchFaq, buildNoMatchFallback, type FaqEntry } from "@/lib/support-faq";
import { isRtlLocale, type Locale } from "@/i18n/locales";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

// The model reads instructions in any language equally well, so the prompt
// itself stays in English (simplest to keep accurate) and only the target
// reply language is parameterized -- avoids needing 13 translated system
// prompts while still making the AI answer in whatever locale is active.
const LANGUAGE_NAMES: Record<Locale, string> = {
  ar: "Arabic", en: "English", fr: "French", es: "Spanish", pt: "Portuguese",
  zh: "Chinese", hi: "Hindi", ur: "Urdu", id: "Indonesian", vi: "Vietnamese",
  th: "Thai", bn: "Bengali", sw: "Swahili",
};

function buildSystemPrompt(locale: Locale): string {
  const language = LANGUAGE_NAMES[locale] ?? "English";
  return `You are the official support assistant for "Copy Matrix", a demo/simulation platform for automatic copy trading (not a real, licensed brokerage). Always reply in ${language} only, in a professional and polite tone befitting a global trading platform, concisely and clearly (3-4 sentences maximum).
- Never give real investment or financial advice, and never predict market movements.
- If asked whether the platform is real, politely clarify that it is a demo environment for demonstration and practice purposes.
- If you are not sure of an answer specific to the user's own account (like their balance or a specific transaction), direct them to contact the human support team via email (support@copy-matrix.test) instead of guessing.
- Never ask the user for their password or any other sensitive data.`;
}

async function callAiFallback(
  message: string,
  history: ChatMessage[],
  apiKey: string,
  locale: Locale,
  tempErrorMsg: string,
  noAnswerMsg: string,
): Promise<string> {
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
      system: buildSystemPrompt(locale),
      messages: [...history.slice(-6), { role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    return tempErrorMsg;
  }

  const data = await res.json();
  const text = data?.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text;
  return typeof text === "string" && text.trim() ? text.trim() : noAnswerMsg;
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

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Faq");
  const entries = t.raw("entries") as FaqEntry[];
  const smallTalk = t.raw("smallTalk") as FaqEntry[];

  const faqMatch = matchFaq(message, entries, smallTalk);
  if (faqMatch) {
    return NextResponse.json({ reply: faqMatch.answer, source: "faq" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const fallback = buildNoMatchFallback(
      entries,
      t("noMatchIntro"),
      t("noMatchOutro"),
      isRtlLocale(locale) ? "، " : ", ",
    );
    return NextResponse.json({ reply: fallback, source: "no_match" });
  }

  const reply = await callAiFallback(message, history, apiKey, locale, t("aiTempError"), t("aiNoClearAnswer"));
  return NextResponse.json({ reply, source: "ai" });
}

export async function GET() {
  const t = await getTranslations("Faq");
  const entries = t.raw("entries") as FaqEntry[];
  return NextResponse.json({ suggestions: entries.slice(0, 4).map((f) => ({ id: f.id, question: f.question })) });
}
