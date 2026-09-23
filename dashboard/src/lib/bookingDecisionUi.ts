import type { BookingDecision } from "./bookingApi.ts";

export const bookingDecisionUi: Record<BookingDecision, {
  pendingAnnouncement: string;
  inboxPath: string;
  savedAnnouncement: string;
}> = {
  confirmed: {
    pendingAnnouncement: "Saving confirmation…",
    inboxPath: "/orders?view=future&notice=confirmed",
    savedAnnouncement: "Request confirmed. The decision has been saved.",
  },
  declined: {
    pendingAnnouncement: "Saving decline…",
    inboxPath: "/orders?view=past&notice=declined",
    savedAnnouncement: "Request declined. The decision has been saved.",
  },
};
