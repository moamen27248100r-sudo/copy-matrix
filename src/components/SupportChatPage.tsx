"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type FaqEntry = { id: string; question: string; answer: string; keywords: string[] };

// Purely decorative grouping so the topic browser doesn't look like a flat
// wall of identical rows -- each id maps to one of four icon glyphs below.
const CATEGORY_BY_ID: Record<string, "wallet" | "shield" | "chart" | "help"> = {
  deposit: "wallet",
  withdraw: "wallet",
  "withdraw-time": "wallet",
  "min-copy": "wallet",
  fees: "wallet",
  "demo-vs-real": "wallet",
  kyc: "shield",
  password: "shield",
  "update-profile": "shield",
  safety: "shield",
  "suspend-account": "shield",
  language: "shield",
  notifications: "shield",
  "about-platform": "chart",
  "how-to-start": "chart",
  "copy-trading": "chart",
  "multiple-traders": "chart",
  "stop-copy": "chart",
  "risk-level": "chart",
  "trust-score": "chart",
  "result-differs-from-trader": "chart",
  "mobile-app": "help",
  "support-contact": "help",
};

function CategoryIcon({ category }: { category: "wallet" | "shield" | "chart" | "help" }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-4 w-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (category === "wallet") {
    return (
      <svg {...common}>
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    );
  }
  if (category === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      </svg>
    );
  }
  if (category === "chart") {
    return (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.8-2.3 3.2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function SupportChatPage() {
  const t = useTranslations("Support");
  const tf = useTranslations("Faq");
  const router = useRouter();

  const faqEntries = tf.raw("entries") as FaqEntry[];

  const [tab, setTab] = useState<"topics" | "chat">("topics");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: t("welcomeMessage") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqEntries;
    return faqEntries.filter(
      (f) => f.question.toLowerCase().includes(q) || f.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [faqEntries, search]);

  useEffect(() => {
    if (tab === "chat") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, tab]);

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

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: nextMessages.slice(0, -1) }),
      });
      const data = await res.json();
      const reply = typeof data.reply === "string" ? data.reply : t("unexpectedError");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("connectionError") }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <style>{`
        @keyframes support-topic-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-center gap-3 border-b border-border bg-[#0b1726] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={goBack}
          aria-label={t("back")}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:border-brand hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 5 15 12 9 19" />
          </svg>
          {t("back")}
        </button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-bold text-foreground">{t("headerTitle")}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            {t("onlineStatus")}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl gap-1.5 px-3 pt-3 sm:px-4">
        <button
          type="button"
          onClick={() => setTab("topics")}
          className={
            tab === "topics"
              ? "flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition"
              : "flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:text-foreground"
          }
        >
          {tf("topicsHeading")}
        </button>
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={
            tab === "chat"
              ? "flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition"
              : "flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:text-foreground"
          }
        >
          {t("chatTab")}
        </button>
      </div>

      {tab === "topics" ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tf("searchTopics")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
          />

          {filteredTopics.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{tf("noSearchResults")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTopics.map((f, i) => {
                const isOpen = expandedId === f.id;
                return (
                  <div
                    key={f.id}
                    style={{ animation: `support-topic-in 260ms ease-out ${Math.min(i, 10) * 30}ms both` }}
                    className="overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : f.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start"
                    >
                      <span
                        className={
                          isOpen
                            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand"
                            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border/60 text-muted"
                        }
                      >
                        <CategoryIcon category={CATEGORY_BY_ID[f.id] ?? "help"} />
                      </span>
                      <span className="flex-1 text-sm font-medium text-foreground">{f.question}</span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div
                      className={
                        isOpen
                          ? "grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out"
                          : "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out"
                      }
                    >
                      <div className="overflow-hidden">
                        <p className="whitespace-pre-line px-3 pb-3 pt-0.5 text-sm leading-relaxed text-muted">
                          {f.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className="text-sm text-brand underline underline-offset-2"
            >
              {tf("askAnything")}
            </button>
          </div>
        </div>
      ) : (
        <>
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
                  {t("typingIndicator")}
                </div>
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
              placeholder={t("inputPlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              {t("send")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
