import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBookingSubmission,
  bookingFormValuesFromSubmission,
  accessSubmissionStorage,
  clearSubmission,
  loadSubmission,
  parseStoredSubmission,
  saveSubmission,
  storeSubmission,
} from "../src/lib/bookingContract.ts";
import {
  BookingApiError,
  BookingProtocolError,
  authoritativeConflictStatus,
  canAttemptDecision,
  classifyCreateError,
  createBooking,
  decideBooking,
  getBookingSubmission,
} from "../src/lib/bookingApi.ts";
import {
  formatDate,
  formatRequestedStart,
  formatTime,
  mapBooking,
} from "../src/lib/orderMapper.ts";
import { pocketBaseResponse } from "../src/lib/pocketbase.ts";

const formValues = {
  customerName: "Ada Lovelace",
  customerPhone: "+49 30 123456",
  customerEmail: "ada@example.com",
  clientNotes: "Call at the courtyard door",
  street: "Invalidenstraße 1",
  postalCode: "10115",
  city: "Berlin",
  country: "DE",
  accessNotes: "Third floor",
  appointmentStart: "2026-10-25T02:30",
  timeOffset: "+02:00",
  estimatedHours: "2.5",
  serviceType: "deep_cleaning",
  budget: "0",
  customerSummary: "Two-bedroom flat",
  cleanerBriefing: "Bring allergy-safe products",
};

const expectedPayload = {
  submission_id: "018f1ea8-42cd-7fa1-9c7a-123456789abc",
  reviewed: true,
  caller_phone: "+49 30 123456",
  client: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    preferred_language: "de",
    notes: "Call at the courtyard door",
  },
  address: {
    street: "Invalidenstraße 1",
    postal_code: "10115",
    city: "Berlin",
    country: "DE",
    access_notes: "Third floor",
  },
  booking: {
    start_time: "2026-10-25T02:30+02:00",
    timezone: "Europe/Berlin",
    estimated_hours: 2.5,
    service_type: "deep_cleaning",
    budget: 0,
    customer_summary: "Two-bedroom flat",
    cleaner_briefing: "Bring allergy-safe products",
  },
  booking_notes: [],
  client_preferences: [],
};

test("review builds the complete atomic payload and preserves an explicit overlap offset", () => {
  assert.deepEqual(
    buildBookingSubmission(
      formValues,
      "018f1ea8-42cd-7fa1-9c7a-123456789abc",
    ),
    expectedPayload,
  );
});

test("blank optional values stay absent so unknown budget differs from zero", () => {
  const payload = buildBookingSubmission(
    {
      ...formValues,
      customerEmail: "  ",
      clientNotes: "",
      accessNotes: "",
      timeOffset: "",
      budget: "",
      customerSummary: "",
      cleanerBriefing: "",
    },
    "018f1ea8-42cd-7fa1-9c7a-123456789abc",
  );

  assert.equal(payload.booking.start_time, "2026-10-25T02:30");
  assert.equal("budget" in payload.booking, false);
  assert.equal("email" in payload.client, false);
  assert.equal("notes" in payload.client, false);
  assert.equal("access_notes" in payload.address, false);
});

test("review rejects missing full address and non-positive duration", () => {
  assert.throws(
    () =>
      buildBookingSubmission(
        { ...formValues, postalCode: "" },
        "018f1ea8-42cd-7fa1-9c7a-123456789abc",
      ),
    /Postal code is required/,
  );
  assert.throws(
    () =>
      buildBookingSubmission(
        { ...formValues, estimatedHours: "0" },
        "018f1ea8-42cd-7fa1-9c7a-123456789abc",
      ),
    /Estimated hours must be a positive number/,
  );
});

test("stored uncertain submissions restore the exact reviewed payload", () => {
  const serialized = storeSubmission({
    phase: "uncertain",
    payload: expectedPayload,
    message: "The result is not known yet.",
  });

  assert.deepEqual(parseStoredSubmission(serialized), {
    phase: "uncertain",
    payload: expectedPayload,
    message: "The result is not known yet.",
  });
  assert.equal(parseStoredSubmission('{"phase":"uncertain"}'), null);
  assert.equal(parseStoredSubmission("not json"), null);
});

test("a definitely failed restored submission reopens with its reviewed details", () => {
  assert.deepEqual(bookingFormValuesFromSubmission(expectedPayload), formValues);
});

test("storage failures are reported before an immutable submission can be sent", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("disabled");
    },
    setItem() {
      throw new Error("disabled");
    },
    removeItem() {
      throw new Error("disabled");
    },
  };

  assert.equal(
    saveSubmission(unavailableStorage, "scoped-key", {
      phase: "reviewed",
      payload: expectedPayload,
    }),
    false,
  );
  assert.equal(loadSubmission(unavailableStorage, "scoped-key").status, "error");
  assert.equal(clearSubmission(unavailableStorage, "scoped-key"), false);
});

test("corrupted scoped storage is retained and blocks a replacement submission", () => {
  const values = new Map([["cleanvoice:cleaner-a", "not json"]]);
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  assert.equal(
    loadSubmission(storage, "cleanvoice:cleaner-a").status,
    "error",
  );
  assert.equal(values.has("cleanvoice:cleaner-a"), true);
});

test("a throwing sessionStorage getter is handled as unavailable", () => {
  const source = Object.defineProperty({}, "sessionStorage", {
    get() {
      throw new Error("blocked");
    },
  });

  assert.equal(accessSubmissionStorage(source), null);
});

test("create sends the immutable payload with the approved timeout", async (t) => {
  const requests = [];
  const timeoutValues = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    timeoutValues.push(milliseconds);
    return new AbortController().signal;
  });
  const result = await createBooking(expectedPayload, async (url, init) => {
    requests.push({ url, init });
    return Response.json(
      {
        status: "created",
        submission_id: expectedPayload.submission_id,
        booking_id: "booking-1",
        booking_status: "requested",
        tentative: true,
      },
      { status: 201 },
    );
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/cleanvoice/create-booking");
  assert.equal(requests[0].init.method, "POST");
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  assert.deepEqual(timeoutValues, [10_000]);
  assert.deepEqual(JSON.parse(requests[0].init.body), expectedPayload);
  assert.deepEqual(result, {
    status: "created",
    submission_id: expectedPayload.submission_id,
    booking_id: "booking-1",
    booking_status: "requested",
    tentative: true,
  });
});

test("the dashboard proxy forwards the cleaner bearer token and payload", async () => {
  const requests = [];
  const response = await pocketBaseResponse(
    "/api/cleanvoice/create-booking",
    {
      auth: "none",
      token: "cleaner-token",
      method: "POST",
      body: expectedPayload,
      fetchImplementation: async (url, init) => {
        requests.push({ url: String(url), init });
        return Response.json({ status: "created" }, { status: 201 });
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal(requests.length, 1);
  assert.equal(
    new URL(requests[0].url).pathname,
    "/api/cleanvoice/create-booking",
  );
  assert.equal(requests[0].init.headers.Authorization, "Bearer cleaner-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), expectedPayload);
});

test("receipt lookup distinguishes a missing receipt from transport failure", async () => {
  await assert.rejects(
    getBookingSubmission(expectedPayload.submission_id, async () =>
      Response.json({ message: "not found" }, { status: 404 }),
    ),
    (error) => error instanceof BookingApiError && error.status === 404,
  );
});

test("malformed successful creates and receipts never navigate to a booking", async () => {
  await assert.rejects(
    createBooking(expectedPayload, async () =>
      Response.json({
        status: "created",
        submission_id: "different-submission",
        booking_id: "booking-1",
        booking_status: "requested",
        tentative: true,
      }),
    ),
    BookingProtocolError,
  );

  await assert.rejects(
    getBookingSubmission(expectedPayload.submission_id, async () =>
      Response.json({
        status: "created",
        submission_id: expectedPayload.submission_id,
        booking_id: "",
        booking_status: "requested",
        tentative: true,
      }),
    ),
    BookingProtocolError,
  );
});

test("only a definite first-attempt client rejection unlocks editing", () => {
  assert.equal(
    classifyCreateError(
      "reviewed",
      new BookingApiError(422, { message: "invalid" }),
    ),
    "failed",
  );
  assert.equal(
    classifyCreateError(
      "reviewed",
      new BookingApiError(502, { message: "unavailable" }),
    ),
    "uncertain",
  );
  assert.equal(
    classifyCreateError("reviewed", new TypeError("network interrupted")),
    "uncertain",
  );
  assert.equal(
    classifyCreateError(
      "reviewed",
      new BookingApiError(409, { message: "submission conflict" }),
    ),
    "uncertain",
  );
});

test("a timeout followed by a 400 remains uncertain and blocks changed details", () => {
  assert.equal(
    classifyCreateError(
      "uncertain",
      new BookingApiError(400, { message: "appointment is now invalid" }),
    ),
    "uncertain",
  );
});

test("decision conflicts retain the persisted booking status", async () => {
  await assert.rejects(
    decideBooking("booking-1", "declined", async () =>
      Response.json({ booking_id: "booking-1", booking_status: "confirmed" }, { status: 409 }),
    ),
    (error) =>
      error instanceof BookingApiError &&
      error.status === 409 &&
      error.body.booking_status === "confirmed",
  );
});

test("only a matching terminal conflict is authoritative", () => {
  assert.equal(
    authoritativeConflictStatus(
      new BookingApiError(409, {
        booking_id: "booking-1",
        booking_status: "confirmed",
        conflict: true,
      }),
      "booking-1",
    ),
    "confirmed",
  );
  assert.equal(
    authoritativeConflictStatus(
      new BookingApiError(409, {
        booking_id: "wrong-booking",
        booking_status: "confirmed",
        conflict: true,
      }),
      "booking-1",
    ),
    null,
  );
  assert.equal(
    authoritativeConflictStatus(
      new BookingApiError(409, {
        booking_id: "booking-1",
        booking_status: "requested",
        conflict: true,
      }),
      "booking-1",
    ),
    null,
  );
});

test("an unclear decision allows only the same action to be retried", () => {
  assert.equal(canAttemptDecision("requested", "confirmed", "confirmed"), true);
  assert.equal(canAttemptDecision("requested", "confirmed", "declined"), false);
  assert.equal(canAttemptDecision("confirmed", null, "confirmed"), false);
});

test("decision success must match the requested booking and decision", async () => {
  await assert.rejects(
    decideBooking("booking-1", "confirmed", async () =>
      Response.json({ booking_id: "booking-2", booking_status: "confirmed" }),
    ),
    BookingProtocolError,
  );
  await assert.rejects(
    decideBooking("booking-1", "confirmed", async () =>
      Response.json({ booking_id: "booking-1", booking_status: "declined" }),
    ),
    BookingProtocolError,
  );
});

test("order mapping shows unknown values and preserves known zero budget", () => {
  const unknown = mapBooking({
    id: "booking-1",
    price: 80,
    price_known: false,
    budget: 0,
    budget_known: false,
  });
  const knownZero = mapBooking({
    id: "booking-2",
    price_known: false,
    budget: 0,
    budget_known: true,
    budget_below_minimum: true,
  });

  assert.equal(unknown.price, "Unknown");
  assert.equal(unknown.budget, "Unknown");
  assert.equal(unknown.reviewedDetailsAvailable, false);
  assert.equal(knownZero.budget, "0");
  assert.equal(knownZero.budgetBelowMinimum, true);
});

test("order detail display prefers the immutable reviewed request snapshot", () => {
  const order = mapBooking({
    id: "booking-1",
    client: "client-1",
    request_snapshot: expectedPayload,
    expand: {
      client: {
        id: "client-1",
        name: "Changed shared client",
        phone: "+49 999",
        email: "invented@example.com",
      },
      address: {
        street: "Changed street",
        postal_code: "99999",
        city: "Changed city",
        access_notes: "Invented access",
      },
    },
  });

  assert.equal(order.customerName, "Ada Lovelace");
  assert.equal(order.customerPhone, "+49 30 123456");
  assert.equal(order.location, "Invalidenstraße 1, 10115, Berlin, DE");
  assert.equal(order.accessNotes, "Third floor");
  assert.equal(order.clientNotes, "Call at the courtyard door");
  assert.equal(order.requestedStart, expectedPayload.booking.start_time);
  assert.equal(order.requestedTimezone, "Europe/Berlin");
  assert.equal(order.reviewedDetailsAvailable, true);
});

test("order detail preserves the requested offset through the Berlin clock overlap", () => {
  const snapshot = structuredClone(expectedPayload);
  snapshot.booking.start_time = "2027-10-31T02:30:00+01:00";
  const order = mapBooking({id: "overlap", request_snapshot: snapshot});

  assert.equal(order.requestedStart, "2027-10-31T02:30:00+01:00");
  assert.equal(formatRequestedStart(order.requestedStart), "31 Oct 2027, 02:30 (UTC+01:00)");
  assert.equal(formatRequestedStart(""), "Not set");
});

test("missing optional snapshot values do not fall back to later shared client data", () => {
  const snapshot = structuredClone(expectedPayload);
  delete snapshot.client.email;
  delete snapshot.address.access_notes;
  const order = mapBooking({
    id: "booking-1",
    request_snapshot: snapshot,
    expand: {
      client: { email: "later@example.com" },
      address: { access_notes: "Later access note" },
    },
  });

  assert.equal(order.customerEmail, "Not set");
  assert.equal(order.accessNotes, "Not set");
});

test("booking dates and times are always formatted in Europe/Berlin", (t) => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "UTC";
  t.after(() => {
    process.env.TZ = previousTimezone;
  });
  const date = new Date("2026-01-01T23:30:00Z");

  assert.equal(formatDate(date), "02 Jan 2026");
  assert.equal(formatTime(date), "00:30");
});
