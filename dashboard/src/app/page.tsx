import Link from "next/link";
import DashboardHeader from "@/src/components/DashboardHeader";
import {
  formatAppointment,
  getOrders,
  type OrderRecord,
} from "@/src/lib/orders";

function StatusBadge({ order }: { order: OrderRecord }) {
  const color =
    order.tone === "green"
      ? "bg-[#edf8f1] text-[#3f8a5c]"
      : "bg-[#fff4e8] text-[#b56c2f]";

  return (
    <span className={`rounded-md px-3 py-1 text-sm font-semibold ${color}`}>
      {order.status}
    </span>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  return (
    <Link
      className="grid w-full grid-cols-[1fr_auto_24px] items-center gap-4 border-b border-[#edf1ee] px-4 py-4 text-left last:border-b-0 hover:bg-[#f8fbf9]"
      href={`/orders/${order.orderId}`}
    >
      <span>
        <span className="block text-base font-semibold text-[#25312a]">
          {order.customerName}
        </span>
        <span className="mt-1 block text-sm font-medium text-[#5e6d63]">
          {formatAppointment(order)} - {order.location}
        </span>
        <span className="mt-1 block text-sm text-[#6b7a70]">
          {order.service}
        </span>
      </span>
      <StatusBadge order={order} />
      <span className="text-2xl leading-none text-[#2f3a33]">{">"}</span>
    </Link>
  );
}

function OrderSection({
  title,
  sectionOrders,
}: {
  title: string;
  sectionOrders: OrderRecord[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-[#25312a]">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-[#e3e9e5] bg-white">
        {sectionOrders.map((order) => (
          <OrderRow key={order.orderId} order={order} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const pageOrders = await getOrders();
  const upcomingOrders = pageOrders.filter(
    (order) => order.category === "upcoming",
  );
  const pastOrders = pageOrders.filter((order) => order.category === "past");

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-6 text-[#162018] sm:px-8">
      <DashboardHeader active="dashboard" />

      <section className="mx-auto max-w-6xl rounded-lg border border-[#e3e9e5] bg-white px-5 py-7 shadow-sm sm:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <h1 className="text-3xl font-semibold tracking-normal text-[#10231d]">
              Cleaner Desk
            </h1>
            <span className="w-fit rounded-full bg-[#edf8f1] px-3 py-1 text-sm font-semibold text-[#2f7d4f]">
              Phone - 3 new calls
            </span>
          </div>

          <button className="w-fit rounded-md border border-[#dfe7e2] bg-white px-4 py-2 text-sm font-semibold text-[#344238] shadow-sm hover:bg-[#f8fbf9]">
            Cleaner language: English
          </button>
          <Link
            className="w-fit rounded-md bg-[#244f3b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3f30]"
            href="/orders/new"
          >
            New order
          </Link>
        </div>

        <div className="space-y-7">
          <OrderSection title="Upcoming" sectionOrders={upcomingOrders} />
          <OrderSection title="Past" sectionOrders={pastOrders} />
        </div>
      </section>
    </main>
  );
}
