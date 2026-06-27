"use client";

import { useRouter } from "next/navigation";
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
  const isHighlighted = format(date, "yyyy-MM-dd") === "2026-06-27";

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

export default function CalendarCard({ orders }: { orders: OrderRecord[] }) {
  const router = useRouter();

  return (
    <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#5f6368]">Schedule</p>
          <h2 className="text-2xl font-semibold tracking-normal text-[#202124]">
            Weekly calendar
          </h2>
        </div>
        <button className="rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-semibold text-[#3c4043] shadow-sm hover:bg-[#f8fafd]">
          + New booking
        </button>
      </div>
      <div className="h-[700px] overflow-hidden rounded-[20px] border border-[#d9e2ec]">
        <Calendar<OrderRecord>
          className="cleanvoice-calendar"
          components={{
            event: BookingEvent,
            week: {
              header: WeekHeader,
            },
          }}
          date={new Date(2026, 5, 27)}
          localizer={localizer}
          events={orders}
          onSelectEvent={(event) => router.push(`/orders/${event.orderId}`)}
          startAccessor="start"
          endAccessor="end"
          titleAccessor={(event) => event.customerName}
          defaultView="week"
          max={new Date(2026, 5, 27, 18, 0)}
          min={new Date(2026, 5, 27, 8, 0)}
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
