"use client";
import BookingReadStatus from "./BookingReadStatus";
import {useBookingRead, type BookingSession} from "@/src/lib/useBookingRead";
import type { ReactNode } from "react";
import BookingDecisionControls from "@/src/components/BookingDecisionControls";
import Badge, { statusTone } from "@/src/components/ui/Badge";
import { Card, InsetGroup } from "@/src/components/ui/Card";
import {
  ClockIcon,
  KeyIcon,
  MapPinIcon,
  MessageIcon,
} from "@/src/components/ui/icons";
import {
  formatDate,
  formatTime,
} from "@/src/lib/orders";

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-[15px] text-secondary">{label}</span>
      <span className="min-w-0 break-words text-right text-[15px] font-medium text-label">
        {value}
      </span>
    </div>
  );
}

function TextCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-label">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <p className="text-[15px] leading-6 text-secondary">{body}</p>
    </Card>
  );
}

function NoteList({
  title,
  icon,
  emptyText,
  items,
}: {
  title: string;
  icon: ReactNode;
  emptyText: string;
  items: { id: string; type: string; importance: string; note: string }[];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-label">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id}>
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-tertiary">
                {item.type}
                <span className="text-tertiary">·</span>
                {item.importance}
              </div>
              <p className="mt-1 text-[15px] leading-6 text-secondary">
                {item.note}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[15px] text-secondary">{emptyText}</p>
      )}
    </Card>
  );
}

export default function BookingDetail({session, orderId}: {session:BookingSession; orderId:string}) {
  const state = useBookingRead(session, {kind:"detail", id:orderId});
  const detail = state.data;
  if (!detail) return <BookingReadStatus state={state} />;
  const { order, notes, preferences } = detail;

  return (
    <div>
      <BookingReadStatus state={state} partial={detail.failedSections} />
      <Badge tone={statusTone(order.tone)}>{order.status}</Badge>
      <BookingDecisionControls
        bookingId={order.orderId}
        initialStatus={order.status}
        reviewComplete={!state.pending && !state.error && detail.failedSections.length === 0}
        canConfirm={order.canConfirm}
        canDecline={order.canDecline}
        onRefresh={state.retry}
      />
      {!order.canConfirm && order.needsReview ? <p className="mb-4">This request is past or has missing/invalid required details. It can only be declined after the complete review loads.</p> : null}
      {order.budgetBelowMinimum ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-group bg-orange-soft px-4 py-3 text-[14px] font-medium text-orange-ink">
          This booking&apos;s budget is below the cleaner&apos;s minimum.
        </div>
      ) : null}

      {/* Hero summary */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-secondary">
              {order.service}
            </p>
            <h2 className="mt-1 break-words text-[26px] font-semibold tracking-tight text-label">
              {order.customerName}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-secondary">
              <MapPinIcon className="h-4 w-4 text-tertiary" />
              {order.location}
            </p>
          </div>
          <div className="shrink-0 rounded-group bg-canvas px-4 py-3 text-right">
            <p className="text-[13px] font-medium text-secondary">
              {formatDate(order.start)}
            </p>
            <p className="mt-0.5 text-[20px] font-semibold tracking-tight text-label">
              {formatTime(order.start)} – {formatTime(order.end)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <InsetGroup header="Appointment">
          <InfoRow label="Date" value={formatDate(order.start)} />
          <InfoRow
            label="Time"
            value={`${formatTime(order.start)} – ${formatTime(order.end)}`}
          />
          <InfoRow label="Location" value={order.location} />
          <InfoRow label="Price" value={order.price} />
          <InfoRow label="Budget" value={order.budget} />
          <InfoRow label="Estimated hours" value={order.estimatedHours} />
          <InfoRow label="Status" value={order.status} />
        </InsetGroup>

        <InsetGroup header="Client" footer={`Order ${order.orderId}`}>
          <InfoRow label="Customer ID" value={order.customerId} />
          <InfoRow label="Phone" value={order.customerPhone} />
          <InfoRow label="Email" value={order.customerEmail} />
          <InfoRow label="Created" value={order.createdAt} />
        </InsetGroup>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <TextCard
          icon={<MessageIcon className="h-5 w-5" />}
          title="Call summary"
          body={order.summary}
        />
        <TextCard
          icon={<ClockIcon className="h-5 w-5" />}
          title="Cleaner briefing"
          body={order.cleanerBriefing}
        />
        <TextCard
          icon={<MessageIcon className="h-5 w-5" />}
          title="Client notes"
          body={order.clientNotes}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <TextCard
          icon={<KeyIcon className="h-5 w-5" />}
          title="Access notes"
          body={order.accessNotes}
        />
        <NoteList
          title="Booking notes"
          icon={<MessageIcon className="h-5 w-5" />}
          emptyText={detail.failedSections.includes("Booking notes") ? "Booking notes failed to load. Retry above." : "No booking notes saved."}
          items={notes}
        />
        <NoteList
          title="Client preferences"
          icon={<MessageIcon className="h-5 w-5" />}
          emptyText={detail.failedSections.includes("Client preferences") ? "Client preferences failed to load. Retry above." : "No client preferences saved."}
          items={preferences}
        />
      </div>
    </div>
  );
}
