"use client";

import { useState } from "react";
import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import { berlinDay, berlinMidnight, calendarWeek, shiftDay, weekDays } from "@/src/lib/bookingCalendar";
import { formatAppointment, formatDate } from "@/src/lib/orders";
import BookingReadStatus from "./BookingReadStatus";
import Badge, { statusTone } from "./ui/Badge";
import { InsetGroup, ListRow } from "./ui/Card";
import { buttonClass } from "./ui/Button";

export default function CalendarCard(session: BookingSession) {
  const [day, setDay] = useState(() => berlinDay(new Date()));
  const state = useBookingRead(session, {kind:"calendar", ...calendarWeek(day)});
  const orders = (state.data?.orders ?? []).filter(order => order.calendarEligible)
    .sort((a,b) => a.start!.getTime()-b.start!.getTime() || a.orderId.localeCompare(b.orderId));
  return <>
    <BookingReadStatus state={state} />
    <nav aria-label="Calendar weeks" className="mb-4 flex flex-wrap items-center gap-4">
      <button className={buttonClass("gray","sm")} type="button" onClick={() => setDay(shiftDay(day,-7))}>Previous week</button>
      <label className="flex items-center gap-2">Week containing
        <input aria-label="Week containing" className="rounded-control bg-surface p-2" type="date" value={day}
          onChange={event => {if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setDay(event.target.value);}} />
      </label>
      <button className={buttonClass("gray","sm")} type="button" onClick={() => setDay(shiftDay(day,7))}>Next week</button>
    </nav>
    <p className="mb-4 text-secondary">Europe/Berlin · Requested appointments are tentative; confirmed appointments are approved.</p>
    {state.data ? <div className="grid gap-4 md:grid-cols-2">
      {weekDays(day).map(date => {
        const from = Date.parse(berlinMidnight(date));
        const to = Date.parse(berlinMidnight(shiftDay(date,1)));
        const matches = orders.filter(order => order.start!.getTime() < to && order.end!.getTime() > from);
        return <InsetGroup key={date} header={formatDate(new Date(date+"T12:00:00Z"))} count={matches.length}>
          {matches.length ? matches.map(order => <ListRow key={order.orderId} href={`/orders/${order.orderId}`}
            title={order.customerName} subtitle={formatAppointment(order)} detail={`${order.service} · ${order.location}`}
            trailing={<Badge tone={statusTone(order.tone)}>{order.status}</Badge>} />)
            : <p className="p-4 text-secondary">No bookings on this day.</p>}
        </InsetGroup>;
      })}
    </div> : null}
  </>;
}
