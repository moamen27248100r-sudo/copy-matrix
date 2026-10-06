export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_TURNS = 6;
const MAX_CONTENT = 1000;

// The support chat forwards client-supplied history to a billed model API: only real
// user/assistant turns of bounded size are kept, so a caller can't inject a "system" turn
// or inflate the prompt (and the platform's API bill) with huge messages.
export function sanitizeChatHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter(
      (m): m is ChatMessage =>
        typeof m === "object" &&
        m !== null &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string" &&
        (m as ChatMessage).content.trim() !== "",
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
  // The messages API needs the conversation to start with a user turn.
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  return turns;
}
