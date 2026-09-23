# Integrated acceptance progress — 2026-09-23

Ticket: [#40](https://github.com/david-guerra/Yoshida/issues/40). This is a progress
record for the candidate containing this document, not an M1 acceptance declaration.
The controlled browser run began on 2026-09-22 and was checked again on 2026-09-23.
Source changes were copied into the isolated dashboard after startup for the
stale-cookie recovery check; the launcher tests checked the final source separately.

## Candidate and setup

- Branch: `codex/atomic-booking-contract`; base `0b886d9936ad7d888e98d02eae11026e4ec62655`.
  The commit containing this record includes the inspected source and documentation.
- macOS 26.6.2; local Node.js 26.5.0 (the M1 runbook specifies 24), Python 3.12.13
  for the agent/launcher, PocketBase 0.39.4, Next.js 16.3.4. Browser: Codex in-app
  browser; its engine version was not exposed in this session.
- The test launcher used a new private directory, PocketBase on `127.0.0.1:8092`,
  caller on `:3020`, dashboard on `:3021`, and `--without-worker`. It generated
  `cleaner@example.test` and `other@example.test`, configured the first active
  cleaner with a €50 minimum, and started with zero bookings. Caller identity was
  the reserved fictional `+12025550102`. Original local environment and data
  remained in place. The launcher did not stop preexisting services on other ports.
- A separate bounded German TTS preflight returned 23 nonempty frames and 173,280
  PCM bytes. It did not establish a two-way browser call.

## Controlled browser and backend results

These were **authenticated synthetic dashboard submissions through the real local
booking API**, made to check the integrated cleaner UI. They were not spoken calls.

| Scenario | Browser observation | Independent persisted check |
| --- | --- | --- |
| A: no caller budget | Request `ziyatk2bxeor33j`, submission `ade6ea0f-3745-4870-813f-20185d8af3c2`, appeared in Needs review without reload. Full drawer showed 25 Sept 2026, 10:00–12:00 Europe/Berlin, complete synthetic address, regular cleaning, original German and English note, budget Not given and price Not agreed. Confirm saved and moved it to Upcoming. | Strengthened verifier returned `confirmed`, source `dashboard`, exactly one booking at this point, one submission/receipt, related data matched the reviewed snapshot, price unknown; other owner could neither read nor decide it. |
| B: €20 below €50 minimum | Request `4qagtygesn92y38`, submission `9c62c59b-62dd-44f6-a760-4661457527a4`, arrived through realtime. Review showed the budget warning, still tentative, and no agreed price. Decline saved. A fresh mobile page showed it in History, with decision controls disabled in full-screen review. | Verifier returned `declined`, source `dashboard`, two bookings total, one submission for B, related data matched review, below-minimum flag true, price unknown, other owner denied. A recheck found A still confirmed. |

At 375×812, the light Schedule displayed only A on 25 Sept, with B absent on 26 Sept.
Agenda, Week and Month each had a 339px-wide, 761.5px-high schedule region at the
same x position, and the document had no horizontal overflow. The mobile review was
visually compared with the approved Fluid prototype; the running desktop Requests
was inspected at 1280×900 in both themes. The app keeps the approved Good Company
bubble, plum navigation, primary Requests inbox and separate Schedule. Intentional
differences are authenticated account data, actual records, a New request control,
real refresh/live status, and the absence of prototype-only preview controls.
The expired-cookie browser flow initially looped away from Sign in again; the new
HTTP regression reproduced that and passed after the login page kept the form
reachable. A browser sign-in using the fresh synthetic account also succeeded.

## Automated evidence

| Check | Result |
| --- | --- |
| Dashboard tests, lint, webpack production build/typecheck | 52 tests passed; lint/build passed |
| Caller tests, lint, webpack production build/typecheck | 26 tests passed; lint/build passed |
| Agent pytest, Ruff lint/format | 75 passed, 3 intentionally skipped opt-in model evaluations; Ruff passed |
| PocketBase JavaScript, real HTTP and Python compile | 9 JavaScript and 13 HTTP tests passed; compile passed |
| New launcher/inspector tests | 3 passed against disposable loopback processes and data |

The new tests cover two clean synthetic owner logins, empty initial reads, exact
booking count and owner isolation, source-copy/env preservation, stale-cookie login
recovery, data retention on shutdown, port release, and a SIGTERM-resistant child.
The strengthened inspector rejected a deliberately corrupted persisted service;
that case failed before the verifier fix and passed afterward. The inherited
backend HTTP suite covers concurrent retries, rollback, Berlin date validation,
owner decisions and loss after commit. Caller and worker controlled tests cover
response loss, late events, no duplicate submissions and bounded recovery.

## Open acceptance items

- Two real reviewed German browser calls with actual microphone and assistant
  playback, one Confirm and one Decline, using a **new empty run**. The controlled
  booking IDs above cannot stand in for their voice receipts.
- Direct observation of hang-up while saving, same-tab reload reconciliation,
  repeated starts and one worker per call in that live run. Controlled automated
  cases exist, but the browser portion has not been performed here.
- Complete accessibility gate: 200% browser zoom, measured contrast, screen-reader
  announcement behavior, full keyboard/focus traversal, long error content and
  reduced motion across both integrated apps. This run checked only selected
  mobile reflow, review and Schedule states.
- Final M1 verification with Node.js 24 as specified by the approved runbook.

Ticket #40 and parent #35 remain open until the required live and accessibility
evidence is recorded. No deployment, telephone integration or showcase publication
is implied by these local checks.
