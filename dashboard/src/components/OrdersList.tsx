"use client";
import Link from "next/link";
import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import { formatAppointment } from "@/src/lib/orders";
import BookingReadStatus from "./BookingReadStatus";
import Badge, { statusTone } from "./ui/Badge";
import { InsetGroup, ListRow } from "./ui/Card";
import { buttonClass } from "./ui/Button";

export default function OrdersList({session, page, view}: {session:BookingSession; page:number; view:string}) {
  const state = useBookingRead(session, {kind:"orders", page, view});
  const data = state.data;
  const href = (target:number) => `/orders?view=${encodeURIComponent(view)}&page=${target}`;
  return <>
    <BookingReadStatus state={state} />
    {data ? <>
      <InsetGroup count={data.total} header="Bookings">
        {data.orders.length ? data.orders.map(order => <ListRow key={order.orderId} href={`/orders/${order.orderId}`}
          title={order.customerName} subtitle={`${formatAppointment(order)} · ${order.location}`}
          detail={`${order.service} · Agreed price: ${order.price}`}
          trailing={<Badge tone={statusTone(order.tone)}>{order.status}</Badge>} />)
          : <p className="p-5">No bookings match this page.</p>}
      </InsetGroup>
      <nav aria-label="Booking pages" className="mt-4 flex items-center gap-4">
        {page > 1 ? <Link className={buttonClass("gray", "sm")} href={href(page-1)}>Previous</Link> : null}
        <span>Page {page} of {Math.max(1, data.totalPages)} · {data.total} bookings</span>
        {page < data.totalPages ? <Link className={buttonClass("gray", "sm")} href={href(page+1)}>Next</Link> : null}
      </nav>
    </> : null}
  </>;
}
