"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import { useReviewSelection } from "@/src/lib/useReviewSelection";
import { berlinDay, berlinMidnight, calendarWeek, calendarMonth, monthDays, shiftMonth, shiftDay, weekDays } from "@/src/lib/bookingCalendar";
import { formatDate, formatTime, type OrderRecord } from "@/src/lib/orders";
import BookingReadStatus from "./BookingReadStatus";
import ReviewDrawer from "./ReviewDrawer";

const modes = ["Agenda", "Week", "Month"] as const;
type Mode = typeof modes[number];

function ScheduleEvent({order, compact, onSelect}: {order: OrderRecord; compact?: boolean; onSelect: () => void}) {
  const status = order.needsReview ? "Requested · tentative" : "Confirmed";
  return <button type="button" className={`schedule-event ${order.status === "Confirmed" ? "confirmed" : "requested"}`} onClick={onSelect}
    aria-label={`Review ${order.customerName}, ${formatDate(order.start)}, ${order.status}`}>
    {compact ? <>
      <strong>{order.customerName}</strong><span>{formatTime(order.start)}–{formatTime(order.end)}</span><small>{status} · {order.estimatedHours} hours</small>
    </> : <>
      <span className="event-time">{formatTime(order.start)}–{formatTime(order.end)}<small>{order.estimatedHours} hours</small></span>
      <span className="event-person"><strong>{order.customerName}</strong><small>{order.service} · {order.location}</small></span><span className="event-status">{status}</span>
    </>}
  </button>;
}

export default function CalendarCard(session: BookingSession) {
  const [day, setDay] = useState(() => berlinDay(new Date()));
  const [mode, setMode] = useState<Mode>("Agenda");
  const viewport = useRef<HTMLDivElement>(null);
  const month = mode === "Month";
  const state = useBookingRead(session, {kind:"calendar", ...(month ? calendarMonth(day) : calendarWeek(day))});
  const review = useReviewSelection(state.retry);
  const orders = (state.data?.orders ?? []).filter(order => order.calendarEligible)
    .sort((a,b) => a.start!.getTime()-b.start!.getTime() || a.orderId.localeCompare(b.orderId));
  const days = month ? monthDays(day) : weekDays(day);
  const hasData = Boolean(state.data);
  useEffect(() => {
    if (mode === "Week" && viewport.current && hasData) viewport.current.scrollTop = 8 * 110;
  }, [mode, day, hasData]);
  const changePeriod = (offset: number) => setDay(month ? shiftMonth(day, offset) : shiftDay(day,offset*7));
  return <>
    <BookingReadStatus state={state} />
    <p role="status" className="save-announcement">{review.announcement}</p>
    <div className="schedule-views"><div className="fluid-tabs" aria-label="Schedule view" role="group" style={{"--selected":modes.indexOf(mode)} as CSSProperties}>
      {modes.map(value => <button type="button" aria-pressed={mode === value} key={value} onClick={() => setMode(value)}>{value}</button>)}
    </div></div>
    <section className="fullcalendar" aria-label={`${mode} schedule`}>
      <header className="calendar-toolbar"><h2>{month ? new Intl.DateTimeFormat("en-GB", {month:"long", year:"numeric", timeZone:"Europe/Berlin"}).format(new Date(day+"T12:00:00Z")) : `${formatDate(new Date(days[0]+"T12:00:00Z"))} – ${formatDate(new Date(days.at(-1)+"T12:00:00Z"))}`}</h2>
        <div className="calendar-navigation"><button type="button" className="icon-button" aria-label={`Previous ${month ? "month" : "week"}`} onClick={() => changePeriod(-1)}>←</button><button type="button" className="icon-button" onClick={() => setDay(berlinDay(new Date()))}>Today</button><button type="button" className="icon-button" aria-label={`Next ${month ? "month" : "week"}`} onClick={() => changePeriod(1)}>→</button></div>
      </header>
      <div className="calendar-legend"><span>◌ Requested · tentative</span><span>● Confirmed</span><label>Go to date <input type="date" aria-label="Schedule date" value={day} onChange={event => {if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setDay(event.target.value);}} /></label></div>
      <div ref={viewport} className={`calendar-viewport ${mode.toLowerCase()}-viewport`} tabIndex={0} aria-label={`${mode} appointments, scroll for more`}>
        {!state.data ? <div className="empty-state"><h3>{state.error ? "Schedule unavailable" : "Loading schedule…"}</h3><p>Use the status above to check this read.</p></div> : <div className={`calendar-days ${mode.toLowerCase()}-days`}>
          {days.map(date => {
            const from = Date.parse(berlinMidnight(date));
            const to = Date.parse(berlinMidnight(shiftDay(date,1)));
            const matches = orders.filter(order => order.start!.getTime() < to && order.end!.getTime() > from);
            return <section key={date} className={`calendar-day ${date === berlinDay(new Date()) ? "is-today" : ""} ${month && date.slice(0,7) !== day.slice(0,7) ? "other-month" : ""}`}>
              <h3><span>{new Intl.DateTimeFormat("en-GB", {weekday:"short", timeZone:"Europe/Berlin"}).format(new Date(date+"T12:00:00Z"))}</span><strong>{Number(date.slice(-2))}</strong></h3>
              <div className="day-appointments">{mode === "Week" ? Array.from({length:24}, (_,hour) => <div key={hour} className="week-hour">
                <span className="hour-label">{String(hour).padStart(2,"0")}:00</span>
                {matches.filter(order => (order.start!.getTime() < from ? 0 : Number(formatTime(order.start).slice(0,2))) === hour).map(order =>
                  <ScheduleEvent key={order.orderId} order={order} compact onSelect={() => review.selectOrder(order.orderId)} />)}
              </div>) : matches.length ? matches.map(order =>
                <ScheduleEvent key={order.orderId} order={order} onSelect={() => review.selectOrder(order.orderId)} />
              ) : <p className="no-appointments">No appointments</p>}</div>
            </section>;
          })}
        </div>}
      </div>
      <footer className="calendar-footer">Europe/Berlin · {state.data ? `${orders.length} appointments in this view` : "Awaiting complete read"}. An empty schedule does not establish availability.</footer>
    </section>
    {review.selectedOrderId ? <ReviewDrawer session={session} orderId={review.selectedOrderId} onClose={review.closeReview} onDecision={review.completeReview} /> : null}
  </>;
}
