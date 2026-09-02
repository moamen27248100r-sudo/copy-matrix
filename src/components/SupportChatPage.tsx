"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORT_FAQ } from "@/lib/support-faq";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "مرحبًا بكم في مركز الدعم الفني لمنصة Copy Matrix. يسعدنا مساعدتكم بخصوص الإيداع، السحب، توثيق الهوية، أو أي استفسار يتعلق بخدمة النسخ التلقائي.",
};

const QUICK_QUESTIONS = SUPPORT_FAQ.slice(0, 4);

export function SupportChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setShowTopics(false);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: nextMessages.slice(0, -1) }),
      });
      const data = await res.json();
      const reply = typeof data.reply === "string" ? data.reply : "عذرًا، حدث خطأ غير متوقع. يُرجى المحاولة مرة أخرى.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (data.source === "no_match") setShowTopics(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "تعذّر الاتصال بالخادم. يُرجى المحاولة مرة أخرى بعد قليل." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className="flex items-center gap-3 border-b border-border bg-[#0b1726] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={goBack}
          aria-label="رجوع"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:border-brand hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 5 15 12 9 19" />
          </svg>
          رجوع
        </button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-bold text-foreground">الدعم الفني — Copy Matrix</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            متصل الآن — الرد خلال دقائق معدودة
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg rounded-bl-sm bg-border px-3 py-2 text-sm text-foreground"
                  : "max-w-[85%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-foreground"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-foreground opacity-70">
              جارٍ إعداد الرد...
            </div>
          </div>
        )}
        {showTopics && !loading && (
          <div className="flex flex-col items-end gap-2 pt-1">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => send(q.question)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-foreground"
              >
                {q.question}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-border p-3 sm:px-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب استفسارك هنا..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
