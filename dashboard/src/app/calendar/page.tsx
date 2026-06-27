import CalendarCard from "@/src/components/CalendarCard";
import DashboardHeader from "@/src/components/DashboardHeader";
import { requireCleanerSession } from "@/src/lib/auth";
import { getOrders } from "@/src/lib/orders";

export default async function CalendarPage() {
  const session = await requireCleanerSession();
  const orders = await getOrders(session.cleanerId, session.token);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-5 text-[#162018] sm:px-8">
      <DashboardHeader active="calendar" />

      <section className="mx-auto max-w-6xl">
        <CalendarCard orders={orders} />
      </section>
    </main>
  );
}
