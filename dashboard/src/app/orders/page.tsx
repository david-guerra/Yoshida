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
    <span className={`rounded-md px-3 py-1 text-xs font-semibold ${color}`}>
      {order.status}
    </span>
  );
}

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-6 text-[#162018] sm:px-8">
      <DashboardHeader active="orders" />

      <section className="mx-auto max-w-6xl rounded-lg border border-[#e3e9e5] bg-white px-5 py-7 shadow-sm sm:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#10231d]">
              Orders
            </h1>
            <p className="mt-2 text-sm text-[#65756a]">
              Database of calls handled by the voice agent.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md bg-[#244f3b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3f30]"
              href="/orders/new"
            >
              New order
            </Link>
            <button className="rounded-md border border-[#dfe7e2] bg-white px-4 py-2 text-sm font-semibold text-[#344238] shadow-sm hover:bg-[#f8fbf9]">
              All calls
            </button>
            <button className="rounded-md border border-[#dfe7e2] bg-white px-4 py-2 text-sm font-semibold text-[#344238] shadow-sm hover:bg-[#f8fbf9]">
              Needs approval
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e3e9e5]">
          <div className="hidden grid-cols-[100px_1.1fr_1fr_1fr_90px_120px] gap-4 border-b border-[#e3e9e5] bg-[#f8fbf9] px-4 py-3 text-xs font-bold uppercase text-[#65756a] lg:grid">
            <span>ID</span>
            <span>Caller</span>
            <span>Appointment</span>
            <span>Service</span>
            <span>Price</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#edf1ee]">
            {orders.map((order) => (
              <Link
                className="grid w-full gap-3 px-4 py-4 text-left hover:bg-[#f8fbf9] lg:grid-cols-[100px_1.1fr_1fr_1fr_90px_120px] lg:items-center lg:gap-4"
                href={`/orders/${order.orderId}`}
                key={order.orderId}
              >
                <span className="text-sm font-semibold text-[#65756a]">
                  {order.orderId}
                </span>
                <span>
                  <span className="block font-semibold text-[#25312a]">
                    {order.customerName}
                  </span>
                  <span className="mt-1 block text-sm text-[#65756a]">
                    Customer {order.customerId}
                  </span>
                </span>
                <span className="text-sm font-medium text-[#344238]">
                  {formatAppointment(order)}
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#344238]">
                    {order.service}
                  </span>
                  <span className="mt-1 block text-sm text-[#65756a]">
                    {order.location}
                  </span>
                </span>
                <span className="text-sm font-semibold text-[#25312a]">
                  {order.price}
                </span>
                <StatusBadge order={order} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
