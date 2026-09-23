import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import LiveOrdersDashboard from "@/src/components/LiveOrdersDashboard";
import { buttonClass } from "@/src/components/ui/Button";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

// Yoshida’s request-first workspace.
export default async function HomePage() {
  const session = await requireCleanerSession();

  return (
    <AppShell
      active="dashboard"
      title="Requests"
      subtitle="A clear inbox. A good day ahead."
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New request
        </Link>
      }
    >
      <LiveOrdersDashboard
        cleanerId={session.cleanerId}
        pocketBaseUrl={getPublicPocketBaseUrl()}
        token={session.token}
      />
    </AppShell>
  );
}
