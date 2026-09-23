import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import { buttonClass } from "@/src/components/ui/Button";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import LiveOrdersDashboard from "@/src/components/LiveOrdersDashboard";
import { bookingDecisionUi } from "@/src/lib/bookingDecisionUi";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

type OrdersSearchParams = Promise<{
  view?: string | string[] | undefined;
  page?: string;
  notice?: string;
}>;

type OrderView = "all" | "future" | "past" | "needs-approval";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOrderView(value: string | undefined): OrderView {
  if (value === "future" || value === "past" || value === "needs-approval") {
    return value;
  }

  return "all";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: OrdersSearchParams;
}) {
  const session = await requireCleanerSession();
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1));
  const activeView = normalizeOrderView(
    firstSearchValue((await searchParams).view),
  );
  const notice = firstSearchValue((await searchParams).notice);
  const initialAnnouncement = notice === "confirmed" || notice === "declined"
    ? bookingDecisionUi[notice].savedAnnouncement
    : "";

  return (
    <AppShell
      active="orders"
      title="Requests"
      subtitle="A clear inbox. A good day ahead."
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New request
        </Link>
      }
    >
      <LiveOrdersDashboard key={activeView + page} {...session} pocketBaseUrl={getPublicPocketBaseUrl()}
        initialPage={page} initialView={activeView === "future" ? "upcoming" : activeView === "past" ? "history" : "review"}
        initialAnnouncement={initialAnnouncement} />
    </AppShell>
  );
}
