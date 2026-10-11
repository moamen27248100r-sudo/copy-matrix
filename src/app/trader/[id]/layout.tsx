import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leaderExists } from "@/lib/leader-exists";

// The existence check lives here, above loading.tsx: a layout is rendered before the page's Suspense
// boundary starts streaming, so an unknown or malformed leader id is a real HTTP 404.
export default async function TraderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!(await leaderExists(supabase, id))) notFound();
  return children;
}
