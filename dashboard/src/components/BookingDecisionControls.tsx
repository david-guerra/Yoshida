"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/src/components/ui/Button";
import {
  authoritativeConflictStatus,
  canAttemptDecision,
  decideBooking,
  type BookingDecision,
} from "@/src/lib/bookingApi";

function normalizedStatus(status: string) {
  return status.trim().toLowerCase().replaceAll(" ", "_");
}

export default function BookingDecisionControls({
  bookingId,
  initialStatus,
  reviewComplete = true, canConfirm = true, canDecline = true, onRefresh,
}: {
  bookingId: string;
  initialStatus: string;
  reviewComplete?: boolean;
  canConfirm?: boolean;
  canDecline?: boolean;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const refresh = onRefresh ?? (() => router.refresh());
  const propStatus = normalizedStatus(initialStatus);
  const [authoritativeResult, setAuthoritativeResult] = useState<{
    basedOn: string;
    status: string;
  } | null>(null);
  const [pending, setPending] = useState<BookingDecision | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [uncertainDecision, setUncertainDecision] =
    useState<BookingDecision | null>(null);
  const status =
    authoritativeResult?.basedOn === propStatus
      ? authoritativeResult.status
      : propStatus;
  const decided = status === "confirmed" || status === "declined";

  const decide = async (decision: BookingDecision) => {
    if (!reviewComplete || (decision === "confirmed" ? !canConfirm : !canDecline)) return;
    if (!canAttemptDecision(status, uncertainDecision, decision)) return;

    setPending(decision);
    setMessage("");
    setFailed(false);

    try {
      const result = await decideBooking(bookingId, decision);
      setAuthoritativeResult({
        basedOn: propStatus,
        status: normalizedStatus(result.booking_status),
      });
      setUncertainDecision(null);
      setMessage(`Booking ${result.booking_status}.`);
      refresh();
    } catch (caught) {
      const actualStatus = authoritativeConflictStatus(caught, bookingId);
      if (actualStatus) {
        setAuthoritativeResult({
          basedOn: propStatus,
          status: actualStatus,
        });
        setUncertainDecision(null);
        setMessage(
          `Decision conflict: this booking is already ${actualStatus}. The persisted state has been refreshed.`,
        );
      } else {
        setUncertainDecision(decision);
        setMessage(
          `The ${decision} outcome is unclear. Refresh the persisted status or retry only this same action.`,
        );
      }
      setFailed(true);
      refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mb-6 rounded-card bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-label">Booking decision</h2>
          <p className="mt-1 text-[14px] text-secondary">
            {decided
              ? `Persisted status: ${status}.`
              : "Confirm or decline this requested booking."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {uncertainDecision ? (
            <button
              className={buttonClass("plain", "md")}
              disabled={pending !== null}
              onClick={refresh}
              type="button"
            >
              Refresh status
            </button>
          ) : null}
          <button
            className={buttonClass("gray", "md")}
            disabled={
              pending !== null || !reviewComplete || !canDecline ||
              !canAttemptDecision(status, uncertainDecision, "declined")
            }
            onClick={() => void decide("declined")}
            type="button"
          >
            {pending === "declined"
              ? "Declining…"
              : uncertainDecision === "declined"
                ? "Retry Decline"
                : "Decline"}
          </button>
          <button
            className={buttonClass("filled", "md")}
            disabled={
              pending !== null || !reviewComplete || !canConfirm ||
              !canAttemptDecision(status, uncertainDecision, "confirmed")
            }
            onClick={() => void decide("confirmed")}
            type="button"
          >
            {pending === "confirmed"
              ? "Confirming…"
              : uncertainDecision === "confirmed"
                ? "Retry Confirm"
                : "Confirm"}
          </button>
        </div>
      </div>
      {message ? (
        <p
          aria-live="polite"
          className={`mt-4 text-[14px] font-medium ${failed ? "text-red-ink" : "text-green-ink"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
