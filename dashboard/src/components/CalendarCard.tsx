"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { EventProps, HeaderProps } from "react-big-calendar";
import type { OrderRecord } from "@/src/lib/orders";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const dayLabels = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

function WeekHeader({ date }: HeaderProps) {
  const isHighlighted = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="cleanvoice-week-header">
      <span className={isHighlighted ? "text-[#0b57d0]" : ""}>
        {dayLabels[date.getDay()]}
      </span>
      <strong className={isHighlighted ? "cleanvoice-week-date-active" : ""}>
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
      <p className="rounded-2xl border border-dashed border-[#d7dfd8] bg-white/70 px-4 py-5 text-sm text-[#65756a]">
        No upcoming bookings are scheduled yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {upcomingOrders.map((order) => (
        <Link
          className="rounded-2xl border border-[#e1e6dd] bg-white p-4 shadow-sm"
          href={`/orders/${order.orderId}`}
          key={order.orderId}
        >
          <p className="text-sm font-semibold text-[#3d6d58]">
            {format(order.start, "EEE, d MMM")} at {format(order.start, "HH:mm")}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#1d2b22]">
            {order.customerName}
          </h3>
          <p className="mt-1 text-sm text-[#65756a]">
            {order.service} - {order.location}
          </p>
        </Link>
      ))}
    </div>
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
    <div className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#3d6d58]">Schedule</p>
          <h2 className="text-2xl font-semibold tracking-normal text-[#202124]">
            Weekly calendar
          </h2>
        </div>
        <Link
          className="w-fit rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] shadow-sm hover:bg-[#f8fafd]"
          href="/orders/new"
        >
          New booking
        </Link>
      </div>

      <div className="md:hidden">
        <MobileBookingList orders={orders} />
      </div>

      <div className="hidden md:block h-[min(680px,calc(100vh-220px))] min-h-[520px] overflow-hidden rounded-2xl border border-[#d9e2ec]">
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
  );
}
