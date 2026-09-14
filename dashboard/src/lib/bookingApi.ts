import type {
  BookingSubmission,
  StoredBookingSubmission,
} from "./bookingContract.ts";

type FetchImplementation = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 10_000;

function requestSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

export type CreatedBooking = {
  status: "created";
  submission_id: string;
  booking_id: string;
  booking_status: "requested";
  tentative: true;
  [key: string]: unknown;
};

export type BookingReceipt = {
  status: "created";
  submission_id: string;
  booking_id: string;
  booking_status: "requested";
  tentative: true;
  [key: string]: unknown;
};

export type BookingDecision = "confirmed" | "declined";

export type BookingDecisionResponse = {
  booking_id: string;
  booking_status: string;
};

export class BookingApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `Booking request failed with status ${status}.`;
    super(message);
    this.name = "BookingApiError";
    this.status = status;
    this.body = body;
  }
}

export class BookingProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingProtocolError";
  }
}

export function classifyCreateError(
  previousPhase: StoredBookingSubmission["phase"],
  error: unknown,
): "failed" | "uncertain" {
  if (previousPhase === "uncertain" || previousPhase === "submitting") {
    return "uncertain";
  }

  if (
    error instanceof BookingApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 409
  ) {
    return "failed";
  }

  return "uncertain";
}

export function authoritativeConflictStatus(
  error: unknown,
  bookingId: string,
): BookingDecision | null {
  if (
    !(error instanceof BookingApiError) ||
    error.status !== 409 ||
    error.body.conflict !== true ||
    error.body.booking_id !== bookingId ||
    (error.body.booking_status !== "confirmed" &&
      error.body.booking_status !== "declined")
  ) {
    return null;
  }

  return error.body.booking_status;
}

export function canAttemptDecision(
  currentStatus: string,
  uncertainDecision: BookingDecision | null,
  decision: BookingDecision,
) {
  if (currentStatus === "confirmed" || currentStatus === "declined") {
    return false;
  }

  return uncertainDecision === null || uncertainDecision === decision;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

async function bookingRequest<T>(
  url: string,
  init: RequestInit,
  fetchImplementation: FetchImplementation,
) {
  const response = await fetchImplementation(url, init);
  const body = await readResponse(response);

  if (!response.ok) {
    throw new BookingApiError(response.status, body);
  }

  return body as T;
}

export function createBooking(
  payload: BookingSubmission,
  fetchImplementation: FetchImplementation = fetch,
) {
  return bookingRequest<CreatedBooking>(
    "/api/cleanvoice/create-booking",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: requestSignal(),
    },
    fetchImplementation,
  ).then((result) => validateReceipt(result, payload.submission_id));
}

export function getBookingSubmission(
  submissionId: string,
  fetchImplementation: FetchImplementation = fetch,
) {
  return bookingRequest<BookingReceipt>(
    `/api/cleanvoice/submissions/${encodeURIComponent(submissionId)}`,
    { method: "GET", cache: "no-store", signal: requestSignal() },
    fetchImplementation,
  ).then((result) => validateReceipt(result, submissionId));
}

export function decideBooking(
  bookingId: string,
  decision: BookingDecision,
  fetchImplementation: FetchImplementation = fetch,
) {
  return bookingRequest<BookingDecisionResponse>(
    `/api/cleanvoice/bookings/${encodeURIComponent(bookingId)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
      signal: requestSignal(),
    },
    fetchImplementation,
  ).then((result) => {
    if (result.booking_id !== bookingId || result.booking_status !== decision) {
      throw new BookingProtocolError(
        "The booking service returned an unexpected decision result.",
      );
    }
    return result;
  });
}

function validateReceipt<T extends BookingReceipt>(
  receipt: T,
  submissionId: string,
) {
  if (
    receipt.submission_id !== submissionId ||
    typeof receipt.booking_id !== "string" ||
    !receipt.booking_id.trim() ||
    receipt.status !== "created" ||
    receipt.booking_status !== "requested" ||
    receipt.tentative !== true
  ) {
    throw new BookingProtocolError(
      "The booking service returned an invalid submission receipt.",
    );
  }

  return receipt;
}
