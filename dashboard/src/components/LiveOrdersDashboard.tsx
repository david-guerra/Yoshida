"use client";

import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import BookingReadStatus from "./BookingReadStatus";
import Badge, { statusTone } from "@/src/components/ui/Badge";
import { InsetGroup, ListRow } from "@/src/components/ui/Card";
import StatTile from "@/src/components/ui/StatTile";
import { MapPinIcon } from "@/src/components/ui/icons";
import { formatAppointment, type OrderRecord } from "@/src/lib/orderMapper";

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

export default function LiveOrdersDashboard(session: BookingSession) {
  const state = useBookingRead(session, {kind: "home"});
  const orders = state.data?.orders ?? [];
  const upcomingOrders = orders.filter(order => order.calendarEligible && order.category === "upcoming");
  const pastOrders = orders.filter(order => order.category === "past");
  const reviewOrders = orders.filter(order => order.needsReview);
  const reviewCount = reviewOrders.length;
  return (
    <div className="space-y-7">
      <BookingReadStatus state={state} />
      {state.data ? <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Upcoming" value={upcomingOrders.length} accent />
        <StatTile label="Needs review" value={reviewCount} />
        <StatTile
          label="In PocketBase"
          value={orders.length}
          icon={<MapPinIcon className="h-4 w-4" />}
        />
      </div>

      <OrderGroup emptyText="No requests awaiting review." orders={reviewOrders} title="Needs review" />
      <OrderGroup
        emptyText="No upcoming calls are assigned to this cleaner yet."
        orders={upcomingOrders.filter(order => !order.needsReview)}
        title="Upcoming confirmed"
      />
      <OrderGroup
        emptyText="Past calls appear here after their booking window ends."
        orders={pastOrders.filter(order => !order.needsReview)}
        title="Past"
      />
      </> : null}
    </div>
  );
}
