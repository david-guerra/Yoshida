# Atomic booking verification — 2026-09-14

Delivery evidence for [ticket #36](https://github.com/david-guerra/Yoshida/issues/36), against the [approved booking contract](https://github.com/david-guerra/Yoshida/issues/28#issuecomment-5584154151) and [implementation step 1](https://github.com/david-guerra/Yoshida/issues/34#issuecomment-5652888005). Tested the implementation committed with this record on `codex/atomic-booking-contract`, based on `73c9a1e`.

## Automated checks

Node 24.20.0, agent Python 3.12.13, uv 0.11.28, PocketBase 0.39.4; macOS. Existing locked dependencies were used. This was not a fresh-clone installation.

| Command | Result |
| --- | --- |
| `npm --prefix dashboard test` | 36 passed |
| `npm --prefix dashboard run lint` | Passed |
| `npm --prefix dashboard exec -- tsc --noEmit --project dashboard/tsconfig.json` | Passed |
| `npm --prefix dashboard run build` | Passed, including TypeScript |
| `npm --prefix web-caller test` | 13 passed |
| `npm --prefix web-caller run lint` | Passed |
| `npm --prefix web-caller run build` | Passed, including TypeScript |
| From `client-call-agent`: `RUN_LIVEKIT_EVALS=0 uv run --frozen --offline pytest -q` | 50 passed, 3 live evaluations skipped |
| From `client-call-agent`: `uv run --frozen --offline ruff check .` and `uv run --frozen --offline ruff format --check .` | Passed |
| `node --test pocketbase/tests/*.test.mjs` | 9 passed |
| `python3 -m py_compile pocketbase/setup_pb.py` | Passed |
| `python3 -m unittest discover -s pocketbase/tests -p 'test_booking_http.py' -v` | 12 passed |

The HTTP tests start their own temporary database, migration directory and random loopback port. They cover complete concurrent creation, changed-payload conflict, rollback including an existing client, required intake and Berlin clock changes, unknown/zero budget, unavailable configured cleaner, owner-only final decisions and direct-write restrictions, private original receipts, restart durability and database uniqueness. A loopback proxy consumes a committed response and closes the caller connection without delivering it; receipt lookup and identical retry produce the same booking with one set of related writes.

Upgrade coverage reconstructs the pre-contract schema from `73c9a1e` in disposable data: all seven base collections have the old broad access rules, the submission collection is absent, and the five new booking fields are absent. Running setup twice preserves legacy records and translated notes, restores owner access rules, and permits retry-safe new creation.

The zero-budget suggestion regression failed before the fix and passed afterward. Omitted and null budgets produce no warning; explicit zero below a configured floor produces a warning without preventing submission. Agent transport-loss tests and dashboard recovery/protocol tests remain tests with doubles, distinct from the real backend HTTP checks.

## Browser and persisted results

Used the Codex in-app browser against a temporary copy of the dashboard, with the existing `node_modules`, no copied environment files, and a fresh `BookingHTTP` fixture backend. The existing dashboard dev server and original database were left running unchanged. The isolated dashboard command was:

```sh
npm run dev -- --webpack --hostname 127.0.0.1 --port 3301
```

Its server/browser PocketBase origins both pointed to the fixture at `http://127.0.0.1:52623`; all four dashboard admin credential variables were blank. Signed out of a stale browser session and signed in as the fixture's normal `cleaner@example.test` user, assigned to `syntheticclean1`. The fixture's second user was `other@example.test`; passwords remained test-only values. The fixture minimum budget was 50.

| Scenario | Observed result |
| --- | --- |
| Manual review, then same-tab reload | Complete details and submission `6e308c77-3fa3-40cb-b4e4-8f3a5720cb4b` retained before sending |
| Create and Confirm | Booking `6ctdlnfczzepmwo`; synthetic caller `+12025550102`; 15 Jan 2099, 10:00–12:00 Europe/Berlin; full address/access note retained; budget and price Unknown |
| Reload after Confirm | Persisted Confirmed status, both decision buttons disabled, price still Unknown |
| Create with explicit zero budget | Submission `e6de267b-6284-4581-9cc5-eb56c2b8450a`, booking `pztogx9rbh7su6j`; synthetic caller `+12025550103`; 16 Jan 2099, 11:00–14:00 Europe/Berlin; Requested with visible below-minimum warning |
| Decline and reload | Persisted Declined status, both decision buttons disabled, zero budget and warning retained, price Unknown |
| Independent authenticated HTTP verification | Exactly two browser-created bookings with the expected owner and terminal states; both receipt lookups still return the original `requested`/tentative result; second-owner detail reads return 404 |

## Review and delivery boundary

Standards and specification reviews ran independently. Fixed stale README access/transaction claims, corrected the prompt's cleaner-language lookup instruction, fixed the zero-budget suggestion warning, and added actual HTTP response-loss coverage. Follow-up reviews reported no outstanding findings.

This record establishes the local atomic booking slice. It does not claim merge to `main`, remote CI execution, the complete read/realtime recovery contract, the approved prototype UI, live German speech, telephone calling, public deployment, or full M1 acceptance. Those remain the subsequent delivery tickets. No provider calls or customer recordings were made, and no original environment or database was changed.
