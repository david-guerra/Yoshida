"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import BookingDetail from "./BookingDetail";
import type { BookingSession } from "@/src/lib/useBookingRead";

export default function ReviewDrawer({session, orderId, onClose, onDecision}: {
  session: BookingSession; orderId: string; onClose: () => void; onDecision: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = useRef(false);
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      // A saved decision can remove the original row from this view.
      (trigger?.isConnected && !saved.current ? trigger : document.getElementById("request-list-heading") ?? document.getElementById("main"))?.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={dialog} className="review-drawer" aria-labelledby="review-title" onCancel={onClose}>
    <header className="review-header"><h2 id="review-title">Request review</h2><div>
      <Link href={`/orders/${orderId}`} className="text-link">Full page</Link>
      <button type="button" className="icon-button" aria-label="Close request" onClick={onClose}>×</button>
    </div></header>
    <div className="review-body"><BookingDetail key={orderId} session={session} orderId={orderId} onDecision={message => { saved.current = true; onDecision(message); }} /></div>
  </dialog>;
}
