"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAppointment,
  mapBooking,
  type OrderRecord,
  type PocketBaseBooking,
} from "@/src/lib/orderMapper";

type PocketBaseList<T> = {
  items?: T[];
};

type PocketBaseRealtimeEvent = {
  action?: string;
  clientId?: string;
  record?: {
    collection?: string;
    collectionName?: string;
  };
};

type LiveOrdersDashboardProps = {
  cleanerId: string;
  initialOrders: OrderRecord[];
  pocketBaseUrl: string;
  token: string;
};

function StatusBadge({ order }: { order: OrderRecord }) {
  const color =
    order.tone === "green"
      ? "bg-[#e8f5ee] text-[#2f7650]"
      : order.tone === "red"
        ? "bg-[#fff0ef] text-[#a94438]"
        : "bg-[#fff5e7] text-[#9d622b]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {order.status}
    </span>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  return (
    <Link
      className="grid w-full gap-4 rounded-2xl border border-[#e1e6dd] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#cbd8ce] hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"
      href={`/orders/${order.orderId}`}
    >
      <span>
        <span className="block text-lg font-semibold text-[#1d2b22]">
          {order.customerName}
        </span>
        <span className="mt-1 block text-sm font-medium text-[#5f6e64]">
          {formatAppointment(order)} - {order.location}
        </span>
        <span className="mt-1 block text-sm text-[#6b7a70]">
          {order.service}
        </span>
      </span>
      <span className="flex items-center justify-between gap-3 sm:justify-end">
        <StatusBadge order={order} />
        <span className="text-sm font-semibold text-[#244f3b]">Open</span>
      </span>
    </Link>
  );
}

function OrderSection({
  emptyText,
  sectionOrders,
  title,
}: {
  emptyText: string;
  sectionOrders: OrderRecord[];
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-[#25312a]">{title}</h2>
      <div className="grid gap-3">
        {sectionOrders.length ? (
          sectionOrders.map((order) => (
            <OrderRow key={order.orderId} order={order} />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[#d7dfd8] bg-white/70 px-4 py-5 text-sm text-[#65756a]">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function buildPocketBaseUrl(path: string, baseUrl: string) {
  return new URL(path, baseUrl);
}

export default function LiveOrdersDashboard({
  cleanerId,
  initialOrders,
  pocketBaseUrl,
  token,
}: LiveOrdersDashboardProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [syncState, setSyncState] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );

  const refreshOrders = useCallback(async () => {
    const url = buildPocketBaseUrl("/api/collections/bookings/records", pocketBaseUrl);
    url.searchParams.set("filter", `cleaner = "${cleanerId}"`);
    url.searchParams.set("sort", "start_time");
    url.searchParams.set("expand", "client,address,cleaner");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      throw new Error("Could not refresh PocketBase bookings.");
    }

    const data = (await response.json()) as PocketBaseList<PocketBaseBooking>;
    setOrders((data.items ?? []).map(mapBooking));
  }, [cleanerId, pocketBaseUrl, token]);

  useEffect(() => {
    const realtimeUrl = buildPocketBaseUrl("/api/realtime", pocketBaseUrl);
    const source = new EventSource(realtimeUrl);

    source.onmessage = async (message) => {
      const eventData = JSON.parse(message.data) as PocketBaseRealtimeEvent;

      if (eventData.clientId) {
        await fetch(realtimeUrl, {
          body: JSON.stringify({
            clientId: eventData.clientId,
            subscriptions: ["bookings"],
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          method: "POST",
        });
        setSyncState("live");
        return;
      }

      const collection =
        eventData.record?.collectionName ?? eventData.record?.collection;

      if (collection === "bookings") {
        await refreshOrders();
      }
    };

    source.onerror = () => {
      setSyncState("offline");
    };

    return () => {
      source.close();
    };
  }, [pocketBaseUrl, refreshOrders, token]);

  const upcomingOrders = useMemo(
    () => orders.filter((order) => order.category === "upcoming"),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => order.category === "past"),
    [orders],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-sm font-semibold text-[#2f7d4f]">
          {orders.length} calls in PocketBase
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#dfe7e2] bg-white px-3 py-1 text-sm font-semibold text-[#53645a]">
          <span
            className={`h-2 w-2 rounded-full ${
              syncState === "live"
                ? "bg-[#2f7d4f]"
                : syncState === "offline"
                  ? "bg-[#c36a3d]"
                  : "bg-[#d99b36]"
            }`}
          />
          {syncState === "live"
            ? "Live updates"
            : syncState === "offline"
              ? "Realtime reconnecting"
              : "Connecting realtime"}
        </span>
      </div>

      <OrderSection
        emptyText="No upcoming calls are assigned to this cleaner yet."
        sectionOrders={upcomingOrders}
        title="Upcoming"
      />
      <OrderSection
        emptyText="Past calls will appear here after their booking window ends."
        sectionOrders={pastOrders}
        title="Past"
      />
    </div>
  );
}
