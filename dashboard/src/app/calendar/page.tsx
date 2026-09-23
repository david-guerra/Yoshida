import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import CalendarCard from "@/src/components/CalendarCard";
import { buttonClass } from "@/src/components/ui/Button";
import { PlusIcon } from "@/src/components/ui/icons";
import { requireCleanerSession } from "@/src/lib/auth";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

export default async function CalendarPage() {
  const session = await requireCleanerSession();

  return (
    <AppShell
      active="calendar"
      title="Schedule"
      subtitle="Make room for the week ahead."
      actions={
        <Link className={buttonClass("filled", "sm")} href="/orders/new">
          <PlusIcon className="h-4 w-4" />
          New request
        </Link>
      }
    >
      <CalendarCard {...session} pocketBaseUrl={getPublicPocketBaseUrl()} />
    </AppShell>
  );
}
