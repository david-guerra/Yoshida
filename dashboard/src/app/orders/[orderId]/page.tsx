import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardHeader from "@/src/components/DashboardHeader";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  formatAppointment,
  formatDate,
  formatTime,
  getOrder,
  type OrderRecord,
} from "@/src/lib/orders";

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

function StatusBadge({ order }: { order: OrderRecord }) {
  const color =
    order.tone === "green"
      ? "bg-[#edf8f1] text-[#3f8a5c]"
      : order.tone === "red"
        ? "bg-[#fff0ef] text-[#b84b3e]"
        : "bg-[#fff4e8] text-[#b56c2f]";

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${color}`}>
      {order.status}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e6dd] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase text-[#65756a]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#25312a]">{value}</p>
    </div>
  );
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const session = await requireCleanerSession();
  const detail = await getOrder(orderId, session.cleanerId, session.token);

  if (!detail) {
    notFound();
  }

  const { order, notes, preferences } = detail;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-5 text-[#162018] sm:px-8">
      <DashboardHeader active="orders" />

      <section className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              className="mb-4 inline-block text-sm font-semibold text-[#2f6b4f] hover:text-[#1d3f30]"
              href="/orders"
            >
              {"<"} Back to orders
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-normal text-[#10231d]">
                {order.customerName}
              </h1>
              <StatusBadge order={order} />
            </div>
            <p className="mt-2 text-sm text-[#65756a]">
              {order.service} in {order.location}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e1e6dd] bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs font-bold uppercase text-[#65756a]">
              Order ID
            </p>
            <p className="mt-1 text-lg font-semibold text-[#25312a]">
              {order.orderId}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Order ID" value={order.orderId} />
          <DetailItem label="Customer ID" value={order.customerId} />
          <DetailItem label="Date" value={formatDate(order.start)} />
          <DetailItem
            label="Time"
            value={`${formatTime(order.start)} - ${formatTime(order.end)}`}
          />
          <DetailItem label="Location" value={order.location} />
          <DetailItem label="Price" value={order.price} />
          <DetailItem label="Status" value={order.status} />
          <DetailItem label="Created at" value={order.createdAt} />
          <DetailItem label="Appointment" value={formatAppointment(order)} />
          <DetailItem label="Customer phone" value={order.customerPhone} />
          <DetailItem label="Customer email" value={order.customerEmail} />
          <DetailItem label="Estimated hours" value={order.estimatedHours} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#25312a]">
              Call summary
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#65756a]">
              {order.summary}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#25312a]">
              Cleaner briefing
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#65756a]">
              {order.cleanerBriefing}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#25312a]">
              Access notes
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#65756a]">
              {order.accessNotes}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#25312a]">
              Booking notes
            </h2>
            <div className="mt-3 space-y-3">
              {notes.length ? (
                notes.map((note) => (
                  <div key={note.id}>
                    <p className="text-sm font-semibold text-[#25312a]">
                      {note.type} - {note.importance}
                    </p>
                    <p className="mt-1 text-sm text-[#65756a]">{note.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#65756a]">No booking notes saved.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#25312a]">
              Client preferences
            </h2>
            <div className="mt-3 space-y-3">
              {preferences.length ? (
                preferences.map((preference) => (
                  <div key={preference.id}>
                    <p className="text-sm font-semibold text-[#25312a]">
                      {preference.type} - {preference.importance}
                    </p>
                    <p className="mt-1 text-sm text-[#65756a]">
                      {preference.note}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#65756a]">
                  No client preferences saved.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
