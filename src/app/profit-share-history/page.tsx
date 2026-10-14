import { redirect } from "next/navigation";

// The profit-share history is a tab of "Copies" now; the old address keeps working.
export default function ProfitShareHistoryPage() {
  redirect("/copies?tab=profit-share");
}
