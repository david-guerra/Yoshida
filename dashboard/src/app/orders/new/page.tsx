import AppShell from "@/src/components/AppShell";
import BookingForm from "@/src/components/BookingForm";
import { requireCleanerSession } from "@/src/lib/auth";

export default async function NewOrderPage() {
  const session = await requireCleanerSession();

  return (
    <AppShell
      active="orders"
      title="New order"
      backHref="/orders"
      subtitle="Review the complete request before creating one tentative booking."
    >
      <BookingForm storageScope={session.cleanerId} />
    </AppShell>
  );
}
