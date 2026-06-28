"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { EventProps, HeaderProps } from "react-big-calendar";
import Badge, { statusTone } from "@/src/components/ui/Badge";
import { InsetGroup, ListRow } from "@/src/components/ui/Card";
import type { OrderRecord } from "@/src/lib/orders";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function WeekHeader({ date }: HeaderProps) {
  const isToday =
    format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="cleanvoice-week-header">
      <span className={isToday ? "text-accent" : ""}>
        {dayLabels[date.getDay()]}
      </span>
      <strong className={isToday ? "cleanvoice-week-date-active" : ""}>
        {format(date, "d")}
      </strong>
    </div>
  );
}

function BookingEvent({ event }: EventProps<OrderRecord>) {
  return (
    <div>
      <strong>{event.customerName}</strong>
      <span>{event.service}</span>
    </div>
  );
}

function MobileBookingList({ orders }: { orders: OrderRecord[] }) {
  const upcomingOrders = orders.filter((order) => order.category === "upcoming");

  if (!upcomingOrders.length) {
    return (
      <div className="overflow-hidden rounded-group bg-surface px-4 py-8 text-center text-[14px] text-secondary shadow-card">
        No upcoming bookings are scheduled yet.
      </div>
    );
  }

  return (
    <InsetGroup header="Upcoming" count={upcomingOrders.length}>
      {upcomingOrders.map((order) => (
        <ListRow
          key={order.orderId}
          href={`/orders/${order.orderId}`}
          title={order.customerName}
          subtitle={`${format(order.start, "EEE, d MMM")} · ${format(
            order.start,
            "HH:mm",
          )}`}
          detail={`${order.service} · ${order.location}`}
          trailing={<Badge tone={statusTone(order.tone)}>{order.status}</Badge>}
        />
      ))}
    </InsetGroup>
  );
}

export default function CalendarCard({ orders }: { orders: OrderRecord[] }) {
  const router = useRouter();
  const calendarDate = useMemo(() => {
    const nextOrder = orders.find((order) => order.category === "upcoming");
    return nextOrder?.start ?? new Date();
  }, [orders]);
  const minTime = useMemo(() => {
    const value = new Date(calendarDate);
    value.setHours(8, 0, 0, 0);
    return value;
  }, [calendarDate]);
  const maxTime = useMemo(() => {
    const value = new Date(calendarDate);
    value.setHours(18, 0, 0, 0);
    return value;
  }, [calendarDate]);

  return (
    <>
      <div className="md:hidden">
        <MobileBookingList orders={orders} />
      </div>

      <div className="hidden md:block">
        <div className="h-[min(720px,calc(100vh-180px))] min-h-[520px] overflow-hidden rounded-card bg-surface shadow-card">
          <Calendar<OrderRecord>
            className="cleanvoice-calendar"
            components={{
              event: BookingEvent,
              week: {
                header: WeekHeader,
              },
            }}
            date={calendarDate}
            localizer={localizer}
            events={orders}
            onSelectEvent={(event) => router.push(`/orders/${event.orderId}`)}
            startAccessor="start"
            endAccessor="end"
            titleAccessor={(event) => event.customerName}
            defaultView="week"
            max={maxTime}
            min={minTime}
            step={30}
            timeslots={2}
            toolbar={false}
            views={["week"]}
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </>
  );
}
