import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingDecisionUi } from "../src/lib/bookingDecisionUi.ts";

test("decision progress is announced and the saved outcome opens its updated inbox", () => {
  assert.deepEqual(bookingDecisionUi, {
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
  });
});
