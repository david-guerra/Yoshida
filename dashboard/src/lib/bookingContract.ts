export type BookingFormValues = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  clientNotes: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  accessNotes: string;
  appointmentStart: string;
  timeOffset: string;
  estimatedHours: string;
  serviceType: string;
  budget: string;
  customerSummary: string;
  cleanerBriefing: string;
};

export type BookingSubmission = {
  submission_id: string;
  reviewed: true;
  caller_phone: string;
  client: {
    name: string;
    email?: string;
    preferred_language: "de";
    notes?: string;
  };
  address: {
    street: string;
    postal_code: string;
    city: string;
    country: string;
    access_notes?: string;
  };
  booking: {
    start_time: string;
    timezone: "Europe/Berlin";
    estimated_hours: number;
    service_type: string;
    budget?: number;
    customer_summary?: string;
    cleaner_briefing?: string;
  };
  booking_notes: [];
  client_preferences: [];
};

export type StoredBookingSubmission = {
  phase: "reviewed" | "submitting" | "uncertain" | "failed";
  payload: BookingSubmission;
  message?: string;
};

type SubmissionStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type SubmissionStorageSource = {
  readonly sessionStorage: SubmissionStorage;
};

export type SubmissionLoadResult =
  | { status: "empty" }
  | { status: "loaded"; submission: StoredBookingSubmission }
  | { status: "error" };

const LOCAL_START_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const SUBMISSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildBookingSubmission(
  values: BookingFormValues,
  submissionId: string,
): BookingSubmission {
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
    throw new Error("A valid submission ID is required.");
  }

  const localStart = required(values.appointmentStart, "Appointment start");
  if (!LOCAL_START_PATTERN.test(localStart)) {
    throw new Error("Appointment start must be a local date and time.");
  }

  const offset = values.timeOffset.trim();
  if (offset && offset !== "+01:00" && offset !== "+02:00") {
    throw new Error("Time clarification must be +01:00 or +02:00.");
  }

  const estimatedHours = Number(
    required(values.estimatedHours, "Estimated hours"),
  );
  if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
    throw new Error("Estimated hours must be a positive number.");
  }

  const rawBudget = values.budget.trim();
  const budget = rawBudget ? Number(rawBudget) : undefined;
  if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error("Budget must be zero or a positive number.");
  }

  const email = optional(values.customerEmail);
  const clientNotes = optional(values.clientNotes);
  const accessNotes = optional(values.accessNotes);
  const customerSummary = optional(values.customerSummary);
  const cleanerBriefing = optional(values.cleanerBriefing);

  return {
    submission_id: submissionId,
    reviewed: true,
    caller_phone: required(values.customerPhone, "Customer phone"),
    client: {
      name: required(values.customerName, "Customer name"),
      ...(email ? { email } : {}),
      preferred_language: "de",
      ...(clientNotes ? { notes: clientNotes } : {}),
    },
    address: {
      street: required(values.street, "Street"),
      postal_code: required(values.postalCode, "Postal code"),
      city: required(values.city, "City"),
      country: required(values.country, "Country"),
      ...(accessNotes ? { access_notes: accessNotes } : {}),
    },
    booking: {
      start_time: `${localStart}${offset}`,
      timezone: "Europe/Berlin",
      estimated_hours: estimatedHours,
      service_type: required(values.serviceType, "Service"),
      ...(budget !== undefined ? { budget } : {}),
      ...(customerSummary ? { customer_summary: customerSummary } : {}),
      ...(cleanerBriefing ? { cleaner_briefing: cleanerBriefing } : {}),
    },
    booking_notes: [],
    client_preferences: [],
  };
}

export function bookingFormValuesFromSubmission(
  payload: BookingSubmission,
): BookingFormValues {
  const offsetMatch = payload.booking.start_time.match(/([+-]\d{2}:\d{2})$/);
  const timeOffset = offsetMatch?.[1] ?? "";
  const appointmentStart = timeOffset
    ? payload.booking.start_time.slice(0, -timeOffset.length)
    : payload.booking.start_time;

  return {
    customerName: payload.client.name,
    customerPhone: payload.caller_phone,
    customerEmail: payload.client.email ?? "",
    clientNotes: payload.client.notes ?? "",
    street: payload.address.street,
    postalCode: payload.address.postal_code,
    city: payload.address.city,
    country: payload.address.country,
    accessNotes: payload.address.access_notes ?? "",
    appointmentStart,
    timeOffset,
    estimatedHours: String(payload.booking.estimated_hours),
    serviceType: payload.booking.service_type,
    budget:
      payload.booking.budget === undefined
        ? ""
        : String(payload.booking.budget),
    customerSummary: payload.booking.customer_summary ?? "",
    cleanerBriefing: payload.booking.cleaner_briefing ?? "",
  };
}

function isBookingSubmission(value: unknown): value is BookingSubmission {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<BookingSubmission>;
  return (
    typeof payload.submission_id === "string" &&
    SUBMISSION_ID_PATTERN.test(payload.submission_id) &&
    payload.reviewed === true &&
    typeof payload.caller_phone === "string" &&
    Boolean(payload.client && typeof payload.client.name === "string") &&
    Boolean(payload.address && typeof payload.address.street === "string") &&
    Boolean(payload.booking && typeof payload.booking.start_time === "string") &&
    Array.isArray(payload.booking_notes) &&
    Array.isArray(payload.client_preferences)
  );
}

export function storeSubmission(submission: StoredBookingSubmission) {
  return JSON.stringify(submission);
}

export function parseStoredSubmission(
  serialized: string | null,
): StoredBookingSubmission | null {
  if (!serialized) return null;

  try {
    const stored = JSON.parse(serialized) as Partial<StoredBookingSubmission>;
    if (
      !["reviewed", "submitting", "uncertain", "failed"].includes(
        stored.phase ?? "",
      ) ||
      !isBookingSubmission(stored.payload)
    ) {
      return null;
    }

    return {
      phase: stored.phase as StoredBookingSubmission["phase"],
      payload: stored.payload,
      ...(typeof stored.message === "string"
        ? { message: stored.message }
        : {}),
    };
  } catch {
    return null;
  }
}

export function saveSubmission(
  storage: SubmissionStorage,
  key: string,
  submission: StoredBookingSubmission,
) {
  try {
    storage.setItem(key, storeSubmission(submission));
    return true;
  } catch {
    return false;
  }
}

export function accessSubmissionStorage(source: SubmissionStorageSource) {
  try {
    return source.sessionStorage;
  } catch {
    return null;
  }
}

export function loadSubmission(
  storage: SubmissionStorage,
  key: string,
): SubmissionLoadResult {
  try {
    const serialized = storage.getItem(key);
    if (serialized === null) {
      return { status: "empty" };
    }
    const submission = parseStoredSubmission(serialized);
    if (!submission) {
      return { status: "error" };
    }
    return { status: "loaded", submission };
  } catch {
    return { status: "error" };
  }
}

export function clearSubmission(storage: SubmissionStorage, key: string) {
  try {
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch {
    return false;
  }
}
