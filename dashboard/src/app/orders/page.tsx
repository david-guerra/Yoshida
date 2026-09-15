import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import { buttonClass } from "@/src/components/ui/Button";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import OrdersList from "@/src/components/OrdersList";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

type OrdersSearchParams = Promise<{
  view?: string | string[] | undefined;
  page?: string;
}>;

type OrderView = "all" | "future" | "past" | "needs-approval";

const orderFilters: { label: string; href: string; view: OrderView }[] = [
  { label: "All", href: "/orders", view: "all" },
  {
    label: "Needs approval",
    href: "/orders?view=needs-approval",
    view: "needs-approval",
  },
  { label: "Upcoming", href: "/orders?view=future", view: "future" },
  { label: "Past", href: "/orders?view=past", view: "past" },
];

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

  return (
    <AppShell
      active="orders"
      title="Orders"
      subtitle="Every call the voice agent handled, qualified, and saved to PocketBase."
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New order
        </Link>
      }
    >
      <div className="mb-5 overflow-x-auto pb-1">
        <SegmentedControl
          segments={orderFilters.map((filter) => ({
            label: filter.label,
            href: filter.href,
            active: filter.view === activeView,
          }))}
        />
      </div>

      <OrdersList session={{...session, pocketBaseUrl:getPublicPocketBaseUrl()}} page={page} view={activeView} />
    </AppShell>
  );
}
