import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import LiveOrdersDashboard from "@/src/components/LiveOrdersDashboard";
import { buttonClass } from "@/src/components/ui/Button";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import { getOrders } from "@/src/lib/orders";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

export default async function HomePage() {
  const session = await requireCleanerSession();
  const pageOrders = await getOrders(session.cleanerId, session.token);

  return (
    <AppShell
      active="dashboard"
      title="Cleaner Desk"
      subtitle="Calls the voice agent has qualified, grouped by what needs you now."
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New order
        </Link>
      }
    >
      <LiveOrdersDashboard
        cleanerId={session.cleanerId}
        initialOrders={pageOrders}
        pocketBaseUrl={getPublicPocketBaseUrl()}
        token={session.token}
      />
    </AppShell>
  );
}
