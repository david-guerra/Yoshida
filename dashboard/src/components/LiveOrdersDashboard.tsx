"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import { useReviewSelection } from "@/src/lib/useReviewSelection";
import { berlinDay } from "@/src/lib/bookingCalendar";
import { formatDate, formatTime, type InboxView } from "@/src/lib/orders";
import BookingReadStatus from "./BookingReadStatus";
import ReviewDrawer from "./ReviewDrawer";
import Badge, { statusTone } from "./ui/Badge";

const views: {key: InboxView; label: string}[] = [
  {key:"review", label:"Needs review"}, {key:"upcoming", label:"Upcoming"}, {key:"history", label:"History"},
];

export default function LiveOrdersDashboard({initialView = "review", initialPage = 1, initialAnnouncement = "", ...session}: BookingSession & {initialView?: InboxView; initialPage?: number; initialAnnouncement?: string}) {
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPage);
  const tabs = useRef<HTMLDivElement>(null);
  const state = useBookingRead(session, {kind:"inbox", view, page, search});
  const review = useReviewSelection(state.retry, initialAnnouncement);
  const data = state.data;
  const groups = view === "review" ? [
    {label:"New today", orders:data?.orders.filter(order => order.createdAt !== "Not set" && !Number.isNaN(Date.parse(order.createdAt)) && berlinDay(new Date(order.createdAt)) === berlinDay(new Date())) ?? []},
    {label:"Earlier", orders:data?.orders.filter(order => order.createdAt === "Not set" || Number.isNaN(Date.parse(order.createdAt)) || berlinDay(new Date(order.createdAt)) !== berlinDay(new Date())) ?? []},
  ] : [{label:view === "upcoming" ? "Confirmed appointments" : "Request history", orders:data?.orders ?? []}];
  function changeView(next: InboxView) { setView(next); setPage(1); }
  return <>
    <BookingReadStatus state={state} />
    <div className="save-announcement" role="status" aria-atomic="true">{review.announcement}</div>
    <section className="collection" aria-label="Your requests">
      <div className="collectionbar">
        <div ref={tabs} className="fluid-tabs" role="tablist" aria-label="Request status" style={{"--selected":views.findIndex(item => item.key === view)} as CSSProperties}>
          {views.map(({key,label}, index) => <button key={key} id={`tab-${key}`} role="tab" aria-selected={view === key} aria-controls="request-list" tabIndex={view === key ? 0 : -1}
            onClick={() => changeView(key)} onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index+1)%3 : event.key === "ArrowLeft" ? (index+2)%3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
              if (next < 0) return;
              event.preventDefault(); changeView(views[next].key);
              (tabs.current?.children[next] as HTMLButtonElement)?.focus();
            }}>{label}<span className="pillcount">{data?.counts?.[key] ?? "—"}</span></button>)}
        </div>
        <label className="request-search"><span className="sr-only">Search requests</span><span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search requests" value={search} onChange={event => {setSearch(event.target.value); setPage(1);}} />
        </label>
      </div>
      <div className="listhead" aria-hidden="true"><span>Client</span><span>Requested time</span><span>Service</span><span>Caller budget</span><span /></div>
      <div className="request-list" id="request-list" role="tabpanel" aria-labelledby={`tab-${view}`} aria-busy={state.pending}>
        <h2 id="request-list-heading" tabIndex={-1} className="sr-only">{views.find(item => item.key === view)?.label}</h2>
        {!data ? <div className="empty-state"><h2>{state.error ? "Requests unavailable" : "Loading requests…"}</h2><p>{state.error ? "Use the recovery action above to try again." : "Your requests will appear here."}</p></div>
          : !data.orders.length ? <div className="empty-state"><Image src="/brand/company-art.svg" width={130} height={88} alt="" /><h2>{search ? "No matching requests" : view === "review" ? "A little room to breathe." : "Nothing here yet."}</h2><p>{search ? "Try a different name, address, phone or service." : "New requests will appear here when they arrive."}</p></div>
          : groups.filter(group => group.orders.length).map(group => <section key={group.label}>
            <div className="group-label"><h3>{group.label}</h3><span>{group.orders.length} on this page</span></div>
            {group.orders.map(order => <button type="button" key={order.orderId} className="request-row" onClick={() => review.selectOrder(order.orderId)} aria-label={`Review ${order.customerName}, ${formatDate(order.start)}, ${order.service}`}>
              <span className="request-person"><span className="avatar" aria-hidden="true">{order.customerName.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</span><span><strong>{order.customerName}</strong><small>{order.location}</small></span></span>
              <span className="request-when"><strong>{formatDate(order.start)}</strong><small>{formatTime(order.start)}–{formatTime(order.end)}</small></span>
              <span className="request-service">{order.service}<small>{order.estimatedHours} hours</small>{view !== "review" ? <Badge tone={statusTone(order.tone)}>{order.status}</Badge> : null}</span>
              <span className="request-budget">{order.budgetKnown ? `€${order.budget}` : "Not given"}{order.budgetBelowMinimum ? <small className="budget-warning">Below minimum</small> : null}</span>
              <span className="row-chevron" aria-hidden="true">›</span>
            </button>)}
          </section>)}
      </div>
      <footer className="tablefooter"><span>{data ? `${data.total} ${search ? "matching " : ""}requests · Page ${data.page} of ${data.totalPages}` : "Awaiting complete read"}</span>
        <nav aria-label="Request pages"><button className="icon-button" disabled={!data || data.page <= 1 || state.pending} aria-label="Previous page" onClick={() => setPage(data!.page-1)}>←</button><button className="icon-button" disabled={!data || data.page >= data.totalPages || state.pending} aria-label="Next page" onClick={() => setPage(data!.page+1)}>→</button></nav>
      </footer>
    </section>
    <p className="request-hint">Requests are tentative until you confirm them. All appointment times are Europe/Berlin.</p>
    {review.selectedOrderId ? <ReviewDrawer session={session} orderId={review.selectedOrderId} onClose={review.closeReview} onDecision={review.completeReview} /> : null}
  </>;
}
