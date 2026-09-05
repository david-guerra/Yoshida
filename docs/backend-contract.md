# PocketBase demo backend

The backend is in `pocketbase/pb_hooks/`; `pocketbase/setup_pb.py` reconstructs a fresh demo schema and seeds a synthetic cleaner. Setup and HTTP tool requests were verified on PocketBase 0.39.4. Generated migrations, existing databases, and the binary are excluded. This is a local-only prototype with deliberately broad access rules.

## Agent routes

All are under the configured `POCKETBASE_URL` (or legacy override). The current client sends JSON plus a tunnel-warning bypass header, without service credentials.

| Method and path | Request / expected use |
| --- | --- |
| `POST /api/cleanvoice/identify-caller` | `caller_phone`; response includes a role and available client/cleaner context |
| `GET /api/cleanvoice/cleaner-briefing?phone=…` | URL-encoded phone; returned briefing for a cleaner |
| `GET /api/cleanvoice/cleaner-preferences?phone=…` | URL-encoded phone; returned business preferences |
| `POST /api/cleanvoice/suggest-cleaner` | Booking request object with service, location, time, optional budget; matching result |
| `POST /api/cleanvoice/create-booking` | Client, address, booking, notes, preferences, caller phone and optional matched cleaner phone; tentative booking result |

See `client-call-agent/prompts/caller-agent-master-prompt.md` for the intended payload and `tests/test_agent.py` for synthetic response examples. The hook is the implementation authority. It always writes booking status `requested` and returns `tentative: true`. Matching selects the first active cleaner (or first record as fallback), with a low-budget warning only; it does not enforce scheduling, service areas, or skills. Writes are sequential and nontransactional, so failed requests/retries can leave partial or duplicate records.

## Dashboard contracts

- User authentication: `POST /api/collections/users/auth-with-password`.
- Cleaner identity: `cleaners` queried by user relation, then email fallback.
- Records referenced: `users`, `cleaners`, `cleaner_preferences`, `clients`, `addresses`, `bookings`, `booking_notes`, `client_preferences`.
- Booking reads expand `client,address,cleaner` and filter by the signed-in cleaner.
- Realtime: `GET /api/realtime`, then `POST /api/realtime` to subscribe to bookings with the user's token. The browser listens for named `PB_CONNECT` and `bookings/*` events and posts the `bookings/*` topic using the connection event ID. This was verified against the disposable local backend.
- Legacy admin fallback tries `_superusers/auth-with-password`, then `admins/auth-with-password`.

The read/write shapes are in `dashboard/src/lib/` and the order/settings server actions. The setup currently grants all authenticated users CRUD access to every base collection, independently of the cleaner filter in the UI. The custom agent routes have no authentication. This is not a tenant-isolated service and must only contain disposable synthetic records on loopback.
