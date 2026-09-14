# PocketBase demo backend

The backend is in `pocketbase/pb_hooks/`. `pocketbase/setup_pb.py` creates or upgrades the schema and seeds one synthetic cleaner. The supported runtime is PocketBase **0.39.4**. Keep the demo on loopback with disposable synthetic data; the caller lookup and briefing routes remain unauthenticated.

## Booking mutations

Set `CLEANVOICE_CLEANER_ID` in the PocketBase server environment to the seeded cleaner's record ID. Creation and suggestions use only that configured, active cleaner. A missing/inactive cleaner prevents a new submission; there is no fallback matching or availability guarantee.

Both voice and manual creation use `POST /api/cleanvoice/create-booking`:

```json
{
  "submission_id": "a-random-uuid-retained-across-retries",
  "reviewed": true,
  "caller_phone": "+12025550102",
  "client": {"name": "Synthetic Caller", "preferred_language": "de"},
  "address": {"street": "Synthetic Testweg 1", "postal_code": "10115", "city": "Berlin", "country": "DE"},
  "booking": {
    "start_time": "2099-01-15T10:00:00",
    "timezone": "Europe/Berlin",
    "estimated_hours": 2,
    "service_type": "regular_cleaning"
  },
  "booking_notes": [],
  "client_preferences": []
}
```

The example date is synthetic; collect and review an appropriate future appointment in use. Name, phone, full address, service, future start and positive duration are required. Local dates use Europe/Berlin independently of the server timezone. Nonexistent times are rejected; a repeated clock-change hour requires an explicit `+01:00` or `+02:00` offset. Explicit `Z` denotes a UTC instant. End time is derived from duration.

Budget is optional and distinct from price. `budget_known` distinguishes omitted budget from zero; `price_known` is false for new requests and remains false on confirmation. `budget_below_minimum` flags a supplied budget below the cleaner's configured floor without rejecting it. Original/translated notes and preferences are preserved. `request_snapshot` retains the original reviewed intake independently of later shared-client changes.

The database transaction includes client/address/booking/notes/preferences and a private `booking_submissions` record. Its unique submission index survives restarts. Identical identity and payload return the same persisted receipt; changed payload returns 409. Any write failure rolls back the whole transaction, including changes to an existing client. Input status and price cannot create a confirmed or priced booking.

Manual requests authenticate with the owning cleaner's normal `users` bearer token. Voice requests carry a private, random `X-Submission-Token` (32–128 URL-safe characters) in addition to the submission identity. Generate and retain both before the HTTP attempt; never put the token in a URL or logs. The server stores only its hash. This is a scoped receipt capability for the loopback demo, not public admission or abuse protection.

`GET /api/cleanvoice/submissions/{submission_id}` returns the original saved tentative receipt to the owning cleaner or holder of the matching private token. It never reports the eventual cleaner decision. A 404 is **not** proof of failed saving: an in-flight request may still commit. Preserve the original identity/payload and reconcile rather than creating another request.

`POST /api/cleanvoice/bookings/{booking_id}/decision` accepts `{"decision":"confirmed"}` or `{"decision":"declined"}`. Backend ownership verification and transition happen atomically. Only the user linked to the assigned cleaner can act; no agent credential or supplied cleaner ID grants authority. Repeating the same decision succeeds without changing the record; an opposing decision returns 409 with the persisted `booking_status`. Request details and final decisions are immutable in this milestone.

## Access and clients

Collection API writes to bookings, submissions, clients, addresses, booking notes and client preferences are locked for ordinary callers. Owner-filtered reads protect the corresponding records and events. Cleaners can update their own profile/preferences but cannot change their ownership relation. Superuser credentials remain maintenance authority and are not used by booking UI actions.

The dashboard proxies mutations with its signed-in cleaner token. Its manual form retains reviewed payload and submission identity through same-tab reload and requires review before saving. An uncertain save blocks changing details. Confirm/Decline controls display pending, persisted and conflict states without optimistic confirmation.

The voice agent retains one reviewed payload, identity and recovery token per conversation, uses a ten-second save deadline and one safe retry, and refuses changed details while that submission is unresolved. Transport loss and malformed receipts remain uncertain. Browser receipt handoff through hang-up/reload and worker restart is part of the subsequent call-lifecycle integration; this backend step does not establish that full voice flow.

## Other routes

| Method and path | Use |
| --- | --- |
| `POST /api/cleanvoice/identify-caller` | Synthetic phone lookup |
| `GET /api/cleanvoice/cleaner-briefing?phone=…` | Localized cleaner briefing |
| `GET /api/cleanvoice/cleaner-preferences?phone=…` | Cleaner preferences |
| `POST /api/cleanvoice/suggest-cleaner` | Configured active cleaner and informational budget warning |

The lookup routes remain a local-only boundary. Public deployment, telephone integration and the complete read/realtime recovery flow require their separate delivery work.

## Verification

```sh
node --test pocketbase/tests/*.test.mjs
python3 -m unittest discover -s pocketbase/tests -p 'test_booking_http.py' -v
```

The HTTP suite starts its own binary, temporary database and random loopback port. It exercises concurrent retries, rollback, Berlin dates, scoped receipts, server restart, uniqueness, final decisions, unauthorized/direct writes, and repeatable legacy-schema upgrade. It never opens the existing `pb_data` directory. Full German audio acceptance remains separate.
