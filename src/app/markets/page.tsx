import { redirect } from "next/navigation";

// Markets is a tab of Discover now; the old address keeps working.
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  redirect(symbol ? `/discover?tab=markets&symbol=${encodeURIComponent(symbol)}` : "/discover?tab=markets");
}
