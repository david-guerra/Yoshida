"use client";

import BookingReadStatus from "./BookingReadStatus";
import { useBookingRead, type BookingSession } from "@/src/lib/useBookingRead";
import BookingDecisionControls from "./BookingDecisionControls";
import Badge, { statusTone } from "./ui/Badge";
import { formatDate, formatRequestedStart, formatTime, type OrderNote } from "@/src/lib/orders";

function Notes({title, items, failed}: {title: string; items: OrderNote[]; failed: boolean}) {
  return <section className="review-section"><h3>{title}</h3>
    {items.map(item => <article className="review-note" key={item.id}>
      <p className="note-label">{item.type} · {item.importance}</p>
      {item.translation ? <><p>{item.translation}</p><p className="note-label">Translation · check important details against the original</p><details><summary>Show original note</summary><p>{item.original || "Original text not saved."}</p></details></> : <><p>{item.original || "No text saved."}</p><p className="note-label">Original note · no translation saved</p></>}
    </article>)}
    {failed ? <p role="status">Some {title.toLowerCase()} could not be loaded. Retry the complete review above.</p> : !items.length ? <p className="muted">No {title.toLowerCase()} saved.</p> : null}
  </section>;
}

export default function BookingDetail({session, orderId, onDecision, returnToInbox = false}: {
  session: BookingSession; orderId: string; onDecision?: (message: string) => void; returnToInbox?: boolean;
}) {
  const state = useBookingRead(session, {kind:"detail", id:orderId});
  const detail = state.data;
  if (!detail) return <BookingReadStatus state={state} />;
  const {order, notes, preferences} = detail;
  return <div className="booking-detail">
    <BookingReadStatus state={state} partial={detail.failedSections} />
    <div className="review-identity"><span className="avatar" aria-hidden="true">{order.customerName.slice(0,1)}</span><div><h2>{order.customerName}</h2><p>{order.customerPhone}</p></div><Badge tone={statusTone(order.tone)}>{order.status}</Badge></div>
    <div className="appointment-card"><h3>{formatDate(order.start)}</h3><p>{formatTime(order.start)}–{formatTime(order.end)} · {order.estimatedHours} hours</p>
      <small>Requested: {formatRequestedStart(order.requestedStart)} · {order.requestedTimezone}</small>
      <small>Saved schedule: Europe/Berlin · {order.needsReview ? "Tentative request" : order.status}</small>
    </div>
    <dl className="review-facts"><div className="full"><dt>Full address</dt><dd>{order.location}</dd></div><div><dt>Service</dt><dd>{order.service}</dd></div><div><dt>Email</dt><dd>{order.customerEmail}</dd></div><div><dt>Caller budget</dt><dd>{order.budgetKnown ? `€${order.budget}` : "Not given"}</dd></div><div><dt>Agreed price</dt><dd>{order.priceKnown ? `€${order.price}` : "Not agreed"}</dd></div></dl>
    {order.budgetBelowMinimum ? <p className="review-warning">The caller budget is below your minimum. This does not reject the request or establish a price.</p> : null}
    <section className="review-section"><h3>Call summary</h3><p>{order.summary}</p></section>
    <section className="review-section"><h3>Cleaner briefing</h3><p>{order.cleanerBriefing}</p></section>
    <section className="review-section"><h3>Client notes</h3><p>{order.clientNotes}</p></section>
    <section className="review-section"><h3>Access notes</h3><p>{order.accessNotes}</p></section>
    <Notes title="Booking notes" items={notes} failed={detail.failedSections.includes("Booking notes")} />
    <Notes title="Client preferences" items={preferences} failed={detail.failedSections.includes("Client preferences")} />
    <p className="request-hint">Request {order.orderId} · Created {order.createdAt}</p>
    {!order.canConfirm && order.needsReview ? <p className="review-warning">This request is past or has missing/invalid required details. It can only be declined after the complete review loads.</p> : null}
    <BookingDecisionControls bookingId={order.orderId} initialStatus={order.status}
      reviewComplete={!state.pending && !state.error && detail.failedSections.length === 0}
      canConfirm={order.canConfirm} canDecline={order.canDecline} onRefresh={state.retry} onDecision={onDecision} returnToInbox={returnToInbox} />
  </div>;
}
