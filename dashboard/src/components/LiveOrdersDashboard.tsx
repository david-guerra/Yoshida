"use client";

import { connectBookingRealtime } from "@/src/lib/bookingRealtime";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge, { statusTone } from "@/src/components/ui/Badge";
import { InsetGroup, ListRow } from "@/src/components/ui/Card";
import StatTile from "@/src/components/ui/StatTile";
import { MapPinIcon } from "@/src/components/ui/icons";
import {
  formatAppointment,
  mapBooking,
  type OrderRecord,
  type PocketBaseBooking,
} from "@/src/lib/orderMapper";

type PocketBaseList<T> = {
  items?: T[];
};

type LiveOrdersDashboardProps = {
  cleanerId: string;
  initialOrders: OrderRecord[];
  pocketBaseUrl: string;
  token: string;
};

type SyncState = "connecting" | "live" | "offline";

function needsReview(order: OrderRecord) {
  const status = order.status.toLowerCase();
  return ["needs approval", "requested", "tentative"].some((value) =>
    status.includes(value),
  );
}

function SyncIndicator({ state }: { state: SyncState }) {
  const config = {
    live: { dot: "bg-green", label: "Live" },
    offline: { dot: "bg-orange", label: "Reconnecting" },
    connecting: { dot: "bg-gray", label: "Connecting" },
  }[state];

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-[13px] font-semibold text-secondary">
      <span className={`relative flex h-2 w-2`}>
        {state === "live" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </span>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  return (
    <ListRow
      href={`/orders/${order.orderId}`}
      title={order.customerName}
      subtitle={`${formatAppointment(order)} · ${order.location}`}
      detail={order.service}
      trailing={<Badge tone={statusTone(order.tone)}>{order.status}</Badge>}
    />
  );
}

function OrderGroup({
  emptyText,
  orders,
  title,
}: {
  emptyText: string;
  orders: OrderRecord[];
  title: string;
}) {
  return (
    <InsetGroup header={title} count={orders.length}>
      {orders.length ? (
        orders.map((order) => <OrderRow key={order.orderId} order={order} />)
      ) : (
        <div className="px-4 py-6 text-center text-[14px] text-secondary">
          {emptyText}
        </div>
      )}
    </InsetGroup>
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
  const [syncState, setSyncState] = useState<SyncState>("connecting");

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

  useEffect(
    () => connectBookingRealtime(pocketBaseUrl, token, refreshOrders, setSyncState),
    [pocketBaseUrl, refreshOrders, token],
  );

  const upcomingOrders = useMemo(
    () => orders.filter((order) => order.category === "upcoming"),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => order.category === "past"),
    [orders],
  );
  const reviewCount = useMemo(
    () => orders.filter(needsReview).length,
    [orders],
  );

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Upcoming" value={upcomingOrders.length} accent />
        <StatTile label="Needs review" value={reviewCount} />
        <StatTile
          label="In PocketBase"
          value={orders.length}
          icon={<MapPinIcon className="h-4 w-4" />}
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-medium text-secondary">
          Synced from PocketBase
        </span>
        <SyncIndicator state={syncState} />
      </div>

      <OrderGroup
        emptyText="No upcoming calls are assigned to this cleaner yet."
        orders={upcomingOrders}
        title="Upcoming"
      />
      <OrderGroup
        emptyText="Past calls appear here after their booking window ends."
        orders={pastOrders}
        title="Past"
      />
    </div>
  );
}
