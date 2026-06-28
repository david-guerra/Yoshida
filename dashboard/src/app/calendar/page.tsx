import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import CalendarCard from "@/src/components/CalendarCard";
import { buttonClass } from "@/src/components/ui/Button";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import { getOrders } from "@/src/lib/orders";

export default async function CalendarPage() {
  const session = await requireCleanerSession();
  const orders = await getOrders(session.cleanerId, session.token);

  return (
    <AppShell
      active="calendar"
      title="Calendar"
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New booking
        </Link>
      }
    >
      <CalendarCard orders={orders} />
    </AppShell>
  );
}
