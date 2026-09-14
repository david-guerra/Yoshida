"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/src/components/ui/Field";
import { WarningIcon } from "@/src/components/ui/icons";
import {
  BookingApiError,
  classifyCreateError,
  createBooking,
  getBookingSubmission,
} from "@/src/lib/bookingApi";
import {
  buildBookingSubmission,
  bookingFormValuesFromSubmission,
  accessSubmissionStorage,
  clearSubmission,
  loadSubmission,
  saveSubmission,
  type BookingFormValues,
  type StoredBookingSubmission,
} from "@/src/lib/bookingContract";

const STORAGE_KEY_PREFIX = "cleanvoice_pending_booking_submission";

const initialValues: BookingFormValues = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  clientNotes: "",
  street: "",
  postalCode: "",
  city: "",
  country: "DE",
  accessNotes: "",
  appointmentStart: "",
  timeOffset: "",
  estimatedHours: "",
  serviceType: "regular_cleaning",
  budget: "",
  customerSummary: "",
  cleanerBriefing: "",
};

const serviceLabels: Record<string, string> = {
  regular_cleaning: "Regular cleaning",
  deep_cleaning: "Deep cleaning",
  move_out: "Move-out",
  office: "Office",
  other: "Other",
};

function formValues(formData: FormData): BookingFormValues {
  const value = (name: keyof BookingFormValues) =>
    String(formData.get(name) ?? "");

  return {
    customerName: value("customerName"),
    customerPhone: value("customerPhone"),
    customerEmail: value("customerEmail"),
    clientNotes: value("clientNotes"),
    street: value("street"),
    postalCode: value("postalCode"),
    city: value("city"),
    country: value("country"),
    accessNotes: value("accessNotes"),
    appointmentStart: value("appointmentStart"),
    timeOffset: value("timeOffset"),
    estimatedHours: value("estimatedHours"),
    serviceType: value("serviceType"),
    budget: value("budget"),
    customerSummary: value("customerSummary"),
    cleanerBriefing: value("cleanerBriefing"),
  };
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[15px]">
      <span className="shrink-0 text-secondary">{label}</span>
      <span className="text-right font-medium text-label">{value}</span>
    </div>
  );
}

export default function BookingForm({ storageScope }: { storageScope: string }) {
  const router = useRouter();
  const storageKey = `${STORAGE_KEY_PREFIX}:${storageScope}`;
  const [values, setValues] = useState(initialValues);
  const [submission, setSubmission] =
    useState<StoredBookingSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [recoveryState, setRecoveryState] =
    useState<"loading" | "ready" | "problem">("loading");

  const persist = (next: StoredBookingSubmission) => {
    const storage = accessSubmissionStorage(window);
    if (!storage || !saveSubmission(storage, storageKey, next)) {
      return false;
    }
    setSubmission(next);
    return true;
  };

  const finish = (bookingId: string) => {
    const storage = accessSubmissionStorage(window);
    if (storage) clearSubmission(storage, storageKey);
    router.push(`/orders/${bookingId}`);
    router.refresh();
  };

  const resolveReceipt = async (payload: StoredBookingSubmission["payload"]) => {
    setBusy(true);
    setError("");
    try {
      const receipt = await getBookingSubmission(payload.submission_id);
      finish(receipt.booking_id);
    } catch (caught) {
      const expired = caught instanceof BookingApiError && caught.status === 401;
      setNeedsLogin(expired);
      const missing = caught instanceof BookingApiError && caught.status === 404;
      const message = expired
        ? "Sign in again to check this booking. Its saved details and submission ID will be retained in this tab."
        : missing
        ? "No receipt is available yet. Retry the exact submission or check again; its ID and details remain unchanged."
        : "The booking result is still unknown. Check again when the service is reachable.";
      const next = { phase: "uncertain" as const, payload, message };
      if (persist(next)) {
        setError(message);
      } else {
        const storageMessage = `${message} Saved recovery storage is unavailable; keep this tab open.`;
        setSubmission({ ...next, message: storageMessage });
        setError(storageMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const recoveryTimer = window.setTimeout(() => {
      const storage = accessSubmissionStorage(window);
      if (!storage) {
        setRecoveryState("problem");
        setError(
          "Saved recovery storage is unavailable. No booking can be reviewed or sent from this browser tab.",
        );
        return;
      }

      const result = loadSubmission(storage, storageKey);
      if (result.status === "error") {
        setRecoveryState("problem");
        setError(
          "The saved booking recovery record cannot be read safely. It may identify an in-flight request, so a replacement submission is blocked.",
        );
        return;
      }
      if (result.status === "empty") {
        setRecoveryState("ready");
        return;
      }

      const restored = result.submission;

      const normalized =
        restored.phase === "submitting"
          ? {
              ...restored,
              phase: "uncertain" as const,
              message:
                "The previous create attempt was interrupted. Checking its receipt.",
            }
          : restored;
      setRecoveryState("ready");
      setSubmission(normalized);
      setValues(bookingFormValuesFromSubmission(normalized.payload));
      setError(normalized.message ?? "");

      if (normalized.phase === "uncertain") {
        void resolveReceipt(normalized.payload);
      }
    }, 0);

    return () => window.clearTimeout(recoveryTimer);
    // Recovery must run once for the persisted payload loaded at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const review = (formData: FormData) => {
    setError("");
    const nextValues = formValues(formData);

    try {
      const payload = buildBookingSubmission(
        nextValues,
        crypto.randomUUID(),
      );
      setValues(nextValues);
      if (!persist({ phase: "reviewed", payload })) {
        setError(
          "This browser cannot retain the reviewed request, so no booking can be sent. Enable session storage and review again.",
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check the booking details.");
    }
  };

  const submit = async () => {
    if (!submission) return;

    const payload = submission.payload;
    const previousPhase = submission.phase;
    setBusy(true);
    setError("");
    if (!persist({ phase: "submitting", payload })) {
      setError(
        "This browser cannot retain the exact request, so nothing was sent. Enable session storage and try again.",
      );
      setBusy(false);
      return;
    }

    try {
      const result = await createBooking(payload);
      finish(result.booking_id);
    } catch (caught) {
      const expired = caught instanceof BookingApiError && caught.status === 401;
      setNeedsLogin(expired);
      const phase = expired ? "uncertain" : classifyCreateError(previousPhase, caught);
      const message = expired
        ? "Sign in again to continue. Your reviewed request is saved in this tab; its result will be checked after login."
        : phase === "failed"
          ? caught instanceof Error
            ? caught.message
            : "The booking was rejected."
          : "The create result is unknown. Keep this submission unchanged and resolve it before starting another.";
      const next = { phase, payload, message };
      if (persist(next)) {
        setError(message);
      } else {
        const storageMessage = `${message} Saved recovery storage is unavailable; keep this tab open.`;
        setSubmission({ phase: "uncertain", payload, message: storageMessage });
        setError(storageMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const edit = () => {
    if (submission?.phase !== "reviewed" && submission?.phase !== "failed") {
      return;
    }

    const storage = accessSubmissionStorage(window);
    if (!storage || !clearSubmission(storage, storageKey)) {
      setError(
        "The saved submission could not be cleared, so editing remains locked.",
      );
      return;
    }
    setSubmission(null);
    setError("");
  };

  if (recoveryState !== "ready") {
    return (
      <div className="space-y-6">
        <Card>
          <h2 className="text-[17px] font-semibold text-label">
            {recoveryState === "loading"
              ? "Checking saved booking"
              : "Booking recovery needs attention"}
          </h2>
          <p
            aria-live="polite"
            className={`mt-2 text-[14px] leading-6 ${
              recoveryState === "problem" ? "text-red-ink" : "text-secondary"
            }`}
          >
            {recoveryState === "loading"
              ? "Please wait before reviewing or sending another request."
              : error}
          </p>
        </Card>
        {recoveryState === "problem" ? (
          <div className="flex flex-wrap justify-end gap-3">
            <Link className={buttonClass("gray", "md")} href="/orders">
              Return to orders
            </Link>
            <button
              className={buttonClass("filled", "md")}
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry recovery
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (submission) {
    const { payload, phase } = submission;
    const uncertain = phase === "uncertain" || phase === "submitting";
    const canEdit = phase === "reviewed" || phase === "failed";

    return (
      <div className="space-y-6">
        {error ? (
          <div
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-group bg-red-soft px-4 py-3 text-[14px] font-medium text-red-ink"
          >
            <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        {needsLogin ? (
          <Link className={buttonClass("filled", "md")} href="/login?next=%2Forders%2Fnew">
            Sign in again
          </Link>
        ) : null}

        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
                Review before creating
              </p>
              <h2 className="mt-1 text-[22px] font-semibold text-label">
                {payload.client.name}
              </h2>
            </div>
            <span className="rounded-full bg-orange-soft px-3 py-1 text-[13px] font-semibold text-orange-ink">
              {uncertain ? "Resolving result" : phase === "failed" ? "Rejected" : "Tentative"}
            </span>
          </div>
          <div className="divide-y divide-separator">
            <ReviewRow label="Phone" value={payload.caller_phone} />
            <ReviewRow
              label="Email"
              value={payload.client.email ?? "Not provided"}
            />
            <ReviewRow label="Language" value="German" />
            <ReviewRow
              label="Address"
              value={`${payload.address.street}, ${payload.address.postal_code} ${payload.address.city}, ${payload.address.country}`}
            />
            <ReviewRow
              label="Access notes"
              value={payload.address.access_notes ?? "Not provided"}
            />
            <ReviewRow
              label="Appointment"
              value={`${payload.booking.start_time} (${payload.booking.timezone})`}
            />
            <ReviewRow
              label="Service"
              value={serviceLabels[payload.booking.service_type] ?? payload.booking.service_type}
            />
            <ReviewRow
              label="Duration"
              value={`${payload.booking.estimated_hours} hours`}
            />
            <ReviewRow
              label="Budget"
              value={payload.booking.budget === undefined ? "Unknown" : `${payload.booking.budget}`}
            />
            <ReviewRow
              label="Client notes"
              value={payload.client.notes ?? "Not provided"}
            />
            <ReviewRow
              label="Customer summary"
              value={payload.booking.customer_summary ?? "Not provided"}
            />
            <ReviewRow
              label="Cleaner briefing"
              value={payload.booking.cleaner_briefing ?? "Not provided"}
            />
          </div>
          <p className="mt-4 break-all text-[12px] text-tertiary">
            Submission {payload.submission_id}
          </p>
        </Card>

        {uncertain ? (
          <Card className="bg-orange-soft shadow-none">
            <p className="text-[14px] leading-6 text-orange-ink">
              Do not change the details or start a new submission until this one is resolved.
            </p>
          </Card>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          {canEdit ? (
            <button
              className={buttonClass("gray", "md")}
              disabled={busy || needsLogin}
              onClick={edit}
              type="button"
            >
              Edit details
            </button>
          ) : null}
          {uncertain ? (
            <button
              className={buttonClass("gray", "md")}
              disabled={busy || needsLogin}
              onClick={() => void resolveReceipt(payload)}
              type="button"
            >
              {busy ? "Checking…" : "Check receipt"}
            </button>
          ) : null}
          <button
            className={buttonClass("filled", "md")}
            disabled={busy || needsLogin}
            onClick={() => void submit()}
            type="button"
          >
            {busy
              ? "Working…"
              : uncertain
                ? "Retry exact submission"
                : phase === "failed"
                  ? "Retry unchanged"
                  : "Create tentative booking"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={review} className="space-y-6">
      {error ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-group bg-red-soft px-4 py-3 text-[14px] font-medium text-red-ink"
        >
          <WarningIcon className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
          Customer & job
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField defaultValue={values.customerName} label="Customer name" name="customerName" required />
          <TextField defaultValue={values.customerPhone} label="Customer phone" name="customerPhone" required />
          <TextField defaultValue={values.customerEmail} label="Customer email" name="customerEmail" type="email" />
          <SelectField defaultValue={values.serviceType} label="Service" name="serviceType" required>
            <option value="regular_cleaning">Regular cleaning</option>
            <option value="deep_cleaning">Deep cleaning</option>
            <option value="move_out">Move-out</option>
            <option value="office">Office</option>
            <option value="other">Other</option>
          </SelectField>
          <TextField defaultValue={values.appointmentStart} label="Appointment start" name="appointmentStart" required type="datetime-local" />
          <SelectField defaultValue={values.timeOffset} label="Time clarification" name="timeOffset">
            <option value="">Berlin local time</option>
            <option value="+01:00">Explicit +01:00 for clock overlap</option>
            <option value="+02:00">Explicit +02:00 for clock overlap</option>
          </SelectField>
          <TextField defaultValue={values.estimatedHours} label="Estimated hours" name="estimatedHours" required step="any" type="number" />
          <TextField defaultValue={values.budget} label="Budget (optional)" min="0" name="budget" step="0.01" type="number" placeholder="Unknown when blank" />
        </div>
        <p className="mt-3 text-[13px] leading-5 text-secondary">
          Leave time clarification on Berlin local time unless the hour occurs twice during the daylight-saving clock change.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
          Full address
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField defaultValue={values.street} label="Street" name="street" required />
          <TextField defaultValue={values.postalCode} label="Postal code" name="postalCode" required />
          <TextField defaultValue={values.city} label="City" name="city" required />
          <TextField defaultValue={values.country} label="Country" name="country" required />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
          Notes
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField defaultValue={values.accessNotes} label="Access notes" name="accessNotes" />
          <TextAreaField defaultValue={values.clientNotes} label="Client notes" name="clientNotes" />
          <TextAreaField defaultValue={values.customerSummary} label="Customer summary" name="customerSummary" />
          <TextAreaField defaultValue={values.cleanerBriefing} label="Cleaner briefing" name="cleanerBriefing" />
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Link className={buttonClass("gray", "md")} href="/orders">
          Cancel
        </Link>
        <button className={buttonClass("filled", "md")} type="submit">
          Review booking
        </button>
      </div>
    </form>
  );
}
