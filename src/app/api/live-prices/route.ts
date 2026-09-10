import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TICK_MS = 2000;
// Stays well under a serverless function's execution limit; the client's
// EventSource reconnects automatically when the stream closes, so this
// just trades one long connection for a chain of short ones.
const MAX_STREAM_MS = 25000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (symbols.length === 0) {
    return new Response("missing symbols", { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const tick = async () => {
        if (closed) return;
        const { data, error } = await supabase.from("market_prices").select("symbol, price").in("symbol", symbols);
        if (!error && data) {
          const prices: Record<string, number> = {};
          for (const row of data) prices[row.symbol] = Number(row.price);
          send("prices", prices);
        }
      };

      await tick();
      interval = setInterval(tick, TICK_MS);
      timeout = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, MAX_STREAM_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
      clearInterval(interval);
      clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
