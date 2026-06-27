import CalendarCard from "@/src/components/CalendarCard";
import DashboardHeader from "@/src/components/DashboardHeader";
import { getOrders } from "@/src/lib/orders";

export default async function CalendarPage() {
  const orders = await getOrders();

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-6 text-[#162018] sm:px-8">
      <DashboardHeader active="calendar" />

      <section className="mx-auto max-w-6xl">
        <CalendarCard orders={orders} />
      </section>
    </main>
  );
}
