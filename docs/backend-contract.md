# Missing PocketBase backend

This is an inventory inferred from the checked-in clients, not a complete schema or a substitute implementation. The repository has no backend source, migrations, access rules, seed, or pinned PocketBase version. Recover those from the team before claiming a reproducible demo.

## Agent routes

All are under the configured `POCKETBASE_URL` (or legacy override). The current client sends JSON plus a tunnel-warning bypass header, without service credentials.

| Method and path | Request / expected use |
| --- | --- |
| `POST /api/cleanvoice/identify-caller` | `caller_phone`; response includes a role and available client/cleaner context |
| `GET /api/cleanvoice/cleaner-briefing?phone=…` | URL-encoded phone; returned briefing for a cleaner |
| `GET /api/cleanvoice/cleaner-preferences?phone=…` | URL-encoded phone; returned business preferences |
| `POST /api/cleanvoice/suggest-cleaner` | Booking request object with service, location, time, optional budget; matching result |
| `POST /api/cleanvoice/create-booking` | Client, address, booking, notes, preferences, caller phone and optional matched cleaner phone; tentative booking result |

See `client-call-agent/prompts/caller-agent-master-prompt.md` for the intended payload and `tests/test_agent.py` for synthetic response examples. These examples do not define all backend validation or error behavior.

## Dashboard contracts

- User authentication: `POST /api/collections/users/auth-with-password`.
- Cleaner identity: `cleaners` queried by user relation, then email fallback.
- Records referenced: `users`, `cleaners`, `cleaner_preferences`, `clients`, `addresses`, `bookings`, `booking_notes`, `client_preferences`.
- Booking reads expand `client,address,cleaner` and filter by the signed-in cleaner.
- Realtime: `GET /api/realtime`, then `POST /api/realtime` to subscribe to bookings with the user's token. The event handling has not been verified against a running backend.
- Legacy admin fallback tries `_superusers/auth-with-password`, then `admins/auth-with-password`.

The read/write shapes are in `dashboard/src/lib/` and the order/settings server actions. Database rules must enforce authorization independently of frontend filters or cookies. Restore and test the actual rules before using even a shared demo instance.
