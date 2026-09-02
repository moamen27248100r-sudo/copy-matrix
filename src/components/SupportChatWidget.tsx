"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_FAQ } from "@/lib/support-faq";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

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

export function SupportChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (pathname?.startsWith("/admin")) return null;

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
    <>
      {open && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-surface sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(70vh,32rem)] sm:w-[min(90vw,22rem)] sm:overflow-hidden sm:rounded-xl sm:border sm:border-border sm:shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border bg-[#0b1726] px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="رجوع"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-brand hover:text-brand"
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

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
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
            className="flex items-center gap-2 border-t border-border p-3"
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
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="الدعم الفني"
          className="fixed bottom-4 right-4 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}
    </>
  );
}
