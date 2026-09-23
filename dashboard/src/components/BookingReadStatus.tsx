"use client";
import Link from "next/link";
import { buttonClass } from "./ui/Button";
import type { BookingViewState } from "@/src/lib/bookingView";
import type { SyncState } from "@/src/lib/bookingRealtime";

export default function BookingReadStatus({state, partial = []}: {
  state: BookingViewState<unknown> & {sync:SyncState; retry:() => void}; partial?: string[];
}) {
  const {data, pending, error, updatedAt, sync, retry} = state;
  const auth = error?.kind === "auth";
  const message = auth ? error.message
    : error ? data ? "Updates paused" : error.message
    : partial.length ? `Review incomplete: ${partial.join(", ")} could not be loaded.`
    : pending ? data ? "Refreshing bookings…" : "Loading bookings…"
    : sync === "live" ? "Live" : "Live updates disconnected. Showing the last successful read.";
  return <div className={`read-status ${error || partial.length ? "read-warning" : ""}`}>
    <p role="status" aria-live="polite" aria-atomic="true">{message}
      {updatedAt ? <span className="ml-2 text-secondary">Last updated {updatedAt.toLocaleTimeString("en-GB", {timeZone:"Europe/Berlin"})}</span> : null}
    </p>
    {auth ? <Link className={buttonClass("filled", "sm")} href="/login">Sign in again</Link>
      : <button className={buttonClass("gray", "sm")} type="button" aria-disabled={pending} onClick={() => { if (!pending) retry(); }}>
        {pending ? "Loading…" : error || partial.length ? "Retry" : "Refresh"}
      </button>}
  </div>;
}
