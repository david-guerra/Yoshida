import Link from "next/link";
import DashboardHeader from "@/src/components/DashboardHeader";
import LiveOrdersDashboard from "@/src/components/LiveOrdersDashboard";
import { requireCleanerSession } from "@/src/lib/auth";
import { getOrders } from "@/src/lib/orders";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

export default async function HomePage() {
  const session = await requireCleanerSession();
  const pageOrders = await getOrders(session.cleanerId, session.token);
  const upcomingCount = pageOrders.filter((order) => order.category === "upcoming").length;
  const needsReviewCount = pageOrders.filter((order) =>
    ["needs approval", "requested", "tentative"].some((status) =>
      order.status.toLowerCase().includes(status),
    ),
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-5 text-[#162018] sm:px-8">
      <DashboardHeader active="dashboard" />

      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#3d6d58]">
              Live booking workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-[#10231d] sm:text-5xl">
              Cleaner Desk
            </h1>
            <p className="mt-3 text-base leading-7 text-[#5f6e64]">
              A simple view of calls the voice agent has qualified, grouped by
              what needs attention now.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] lg:min-w-[520px]">
            <div className="rounded-2xl border border-[#e1e6dd] bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-[#718076]">
                Upcoming
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#10231d]">
                {upcomingCount}
              </p>
            </div>
            <div className="rounded-2xl border border-[#e1e6dd] bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-[#718076]">
                Needs review
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#10231d]">
                {needsReviewCount}
              </p>
            </div>
            <Link
              className="flex min-h-20 items-center justify-center rounded-2xl bg-[#244f3b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d3f30] focus:outline-none focus:ring-2 focus:ring-[#9dccac]"
              href="/orders/new"
            >
              New order
            </Link>
          </div>
        </div>

        <LiveOrdersDashboard
          cleanerId={session.cleanerId}
          initialOrders={pageOrders}
          pocketBaseUrl={getPublicPocketBaseUrl()}
          token={session.token}
        />
      </section>
    </main>
  );
}
