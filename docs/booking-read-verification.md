# Booking read and realtime verification — 2026-09-15

Delivery evidence for [ticket #37](https://github.com/david-guerra/Yoshida/issues/37), against the [approved read contract](https://github.com/david-guerra/Yoshida/issues/30) and [delivery sequence](https://github.com/david-guerra/Yoshida/issues/34). Verification started on September 14 and concluded on September 15. Tested the implementation committed with this record on `codex/atomic-booking-contract`, based on `1b2eebe`.

## Automated checks

macOS, Node 26.5.0, agent Python 3.12.13, uv 0.11.28, PocketBase 0.39.4. Existing locked dependencies were used; this was not a fresh installation. The repository declares Node 24 for setup/CI; this run used Node 26 and does not establish a Node 24 result.

| Command | Result |
| --- | --- |
| `npm --prefix dashboard test` | 47 passed |
| `npm --prefix dashboard run lint` | Passed |
| From `dashboard`: `npx tsc --noEmit` | Passed |
| From isolated dashboard copy: `npm run build -- --webpack` | Passed, including TypeScript |
| `npm --prefix web-caller test` | 13 passed |
| `npm --prefix web-caller run lint` | Passed |
| From isolated caller copy: `npm run build -- --webpack` | Passed, including TypeScript |
| From `client-call-agent`: `RUN_LIVEKIT_EVALS=0 uv run --frozen --offline pytest -q` | 50 passed, 3 live evaluations skipped |
| From `client-call-agent`: `uv run --frozen --offline ruff check .` and `uv run --frozen --offline ruff format --check .` | Passed |
| `node --test pocketbase/tests/*.test.mjs` | 9 passed |
| `python3 -m py_compile pocketbase/setup_pb.py pocketbase/tests/test_booking_http.py pocketbase/tests/test_booking_reads_http.py pocketbase/tests/serve_read_demo.py` | Passed |
| `python3 -m unittest discover -s pocketbase/tests -p 'test_booking*http.py' -v` | 13 passed |

The new HTTP test starts an actual disposable PocketBase server, seeds 32 bookings and 31 notes/preferences, and invokes the dashboard's shared TypeScript reader through Node. It checks pagination, direct access to a booking beyond the first page, Berlin overlap filters, complete related sections, invalid authentication, and second-owner isolation for list/detail/filter requests. Real named SSE events for bookings, notes, preferences, clients, addresses, and cleaners reach the owner and remain private from the other account. The existing 12 HTTP tests retain transactional creation and decision coverage.

Controlled dashboard tests cover ten-second per-attempt deadlines, one retry, aborts, stale data retention, initial errors, auth invalidation, late results after query/account changes, and partial related reads. Realtime tests distinguish an accepted subscription from a successful reconciliation, reject stale callbacks after cleanup, keep manual reads offline during a stream outage, and verify reconnect delays capped at 30 seconds. These are deterministic boundary tests, separate from real HTTP/SSE and browser evidence.

Date regressions reject malformed saved timestamps, impossible civil dates, ambiguous Berlin autumn times, spring gaps, and offsets inconsistent with Berlin. Calendar date arithmetic is tested under multiple host time zones, including Los Angeles across its different DST transition. Unknown schedules/statuses remain unknown; past requested bookings remain reviewable with Decline only.

## Repeatable browser fixture

Used the in-app browser with a temporary dashboard copy, existing `node_modules`, no copied environment files, and all dashboard admin credential variables blank. The existing user database and dev server were left untouched. Both server and browser PocketBase origins pointed to the disposable proxy.

```sh
python3 pocketbase/tests/serve_read_demo.py
# In the isolated dashboard, with both PocketBase origins set to the printed proxy:
npm run dev -- --webpack --hostname 127.0.0.1 --port 3302
```

The helper prints the backend URL, proxy URL, and oldest booking ID. It uses the synthetic accounts in `test_booking_http.py`. Enter one JSON command per line in its terminal:

```json
{"fault":{"path":"/bookings/","status":503}}
{"fault":{"path":"/booking_notes/","status":503}}
{"fault":{"path":"/auth-refresh","status":401}}
{"fault":{"path":"/api/realtime","status":503}}
{"fault":{"path":""}}
{"create":{"name":"Realtime acceptance request"}}
{"inspect":"BOOKING_ID_FROM_OUTPUT"}
{"quit":true}
```

Each fault replaces the preceding fault; clearing the path restores normal proxy behavior. Quit removes the disposable backend. In this run, backend port 57742, proxy port 57818, and dashboard port 3302 were used. Record IDs below are evidence from this run and change on each fixture run.

## Browser and persisted results

| Scenario | Observed result |
| --- | --- |
| Owner login and complete reads | Home total 32; Orders page 1 had 30 rows and page 2 had 2, with total 32 |
| Detail beyond the first page | Direct access to oldest booking `ya16kt8zkb0y6bd` loaded all review sections |
| Partial notes failure | Address and other readable facts remained visible, incomplete review was labelled, and both decisions were disabled |
| Retry after notes recovery | Keyboard activation recovered the full section, including `Review note 30`, and enabled Confirm |
| Confirm and reload | Oldest booking remained Confirmed; an independent authenticated HTTP read also returned Confirmed |
| Failed refresh | Booking rows remained visible with “Updates paused”, a successful-read timestamp, and Retry |
| Reload during the same failure | Initial error appeared with zero booking rows; it did not claim an empty booking set |
| Recovery | Clearing the controlled fault and retrying restored data and Live |
| New request outside the dashboard | `Realtime acceptance request` appeared once without reload; total rose to 33 |
| Decline and reload | Booking `xrzh2w8kcazmk50`, submission `102049a9-51e4-4a8f-b7a5-b9d37ce0e58a`, remained Declined; independent HTTP read agreed |
| Calendar range | Week containing 15 Jan 2099 showed 32 eligible requested/confirmed bookings at 10:00–12:00 Berlin time; the declined booking was excluded |
| Auth expiry | Controlled auth-refresh 401 removed private booking content and showed Sign in again |
| Second owner | No first-owner rows; direct access to the first owner's detail produced the neutral unavailable message |
| Missing cleaner profile | Removing only the empty second profile in the disposable fixture produced the distinct setup error on retry |
| Stream outage | Successful reads remained visible with the disconnected label; manual Refresh did not claim Live |
| Stream recovery | Clearing the stream fault restored Live after reconciliation without duplicate rows |
| Cross-tab sign-out | Signing out in one tab immediately removed private rows in the other tab and required sign-in |
| Desktop and mobile | Inspected 1280px desktop and 375×812 mobile layouts; status/Retry remained visible and mobile had no horizontal overflow |
| Keyboard focus | Enter activated recovery controls; the final Refresh check retained button focus during Loading and after returning to Live |

## Review and delivery boundary

Independent standards and specification reviews identified duplicate pagination logic, host-zone calendar assumptions, malformed dates, and partial snapshots hiding failed relations. Those findings were fixed and covered by regressions. Follow-up reviews reported no outstanding findings. The final keyboard check also led to retaining focus while Retry/Refresh is busy.

This delivers shared owner-authenticated dashboard reads and recovery. Calendar currently uses a day-grouped week presentation; the approved prototype design remains a later ticket. No claim is made for remote CI, merge to `main`, live German voice acceptance, telephone calling, public deployment, or complete M1 acceptance. No provider calls or customer recordings were made.
