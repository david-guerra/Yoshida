import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import Badge, { statusTone } from "@/src/components/ui/Badge";
import { buttonClass } from "@/src/components/ui/Button";
import { InsetGroup, ListRow } from "@/src/components/ui/Card";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  formatAppointment,
  getOrders,
  type OrderRecord,
} from "@/src/lib/orders";

type OrdersSearchParams = Promise<{
  view?: string | string[] | undefined;
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

function needsApproval(order: OrderRecord) {
  const status = order.status.toLowerCase();

  return ["needs approval", "requested", "tentative"].some((reviewStatus) =>
    status.includes(reviewStatus),
  );
}

function filterOrders(orders: OrderRecord[], activeView: OrderView) {
  if (activeView === "past") {
    return orders.filter((order) => order.category === "past");
  }

  if (activeView === "future") {
    return orders.filter((order) => order.category === "upcoming");
  }

  if (activeView === "needs-approval") {
    return orders.filter(needsApproval);
  }

  return orders;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: OrdersSearchParams;
}) {
  const session = await requireCleanerSession();
  const orders = await getOrders(session.cleanerId, session.token);
  const activeView = normalizeOrderView(
    firstSearchValue((await searchParams).view),
  );
  const filteredOrders = filterOrders(orders, activeView);

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

      <InsetGroup count={`${filteredOrders.length}`}>
        {filteredOrders.length ? (
          filteredOrders.map((order) => (
            <ListRow
              key={order.orderId}
              href={`/orders/${order.orderId}`}
              title={order.customerName}
              subtitle={`${formatAppointment(order)} · ${order.location}`}
              detail={`${order.service} · ${order.price}`}
              trailing={
                <Badge tone={statusTone(order.tone)}>{order.status}</Badge>
              }
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center text-[14px] text-secondary">
            {orders.length
              ? "No orders match this filter yet."
              : "No PocketBase bookings are assigned to this cleaner yet."}
          </div>
        )}
      </InsetGroup>
    </AppShell>
  );
}
