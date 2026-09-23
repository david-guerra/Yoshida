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

## Fresh live German browser run

The committed candidate `60d852f84b62876e4d5d7aeb44f173874494a1e9` was launched
unchanged with a new private data directory at
`/private/tmp/yoshida-acceptance-live-20260923`. PocketBase ran on `:8093`, the
caller on `:3030`, and the dashboard on `:3031`. The named worker registered in
the speech project. The generated owner and unrelated owner were the only cleaner
accounts, and the database initially had zero bookings. The user spoke both calls
in the Codex in-app browser. They separately confirmed hearing assistant speech,
reviewing the German summaries, explicitly approving before the saved receipts,
and exercising an omitted or corrected detail in both calls. This human report is
distinct from the persisted and browser observations below.

| Call | Browser and owner observation | Independent persisted check |
| --- | --- | --- |
| A: `6ef2a7da-be66-4879-99f6-2f6c897456ba` | A new tentative receipt for `zhwevpk3x2cayoh` survived hang-up and same-tab reload. Requests received it live. Review showed Tom Beispiel, Kastanienallee 12 with Hinterhaus access, 25 Sept 2026 10:00–12:00 Berlin, regular cleaning, kitchen note and cat preference with originals/translations, budget Not given and price Not agreed. Owner Confirm moved it to Upcoming and Schedule. | Submission `2b2fb30b-3b55-4184-8521-0d3164ad66e8`; `verify_demo_booking.py --status confirmed --count 2 --budget unknown` passed. One ledger save attempt, matching voice-call source and reviewed payload; original tentative receipt unchanged; unrelated owner read/decision denied. |
| B: `60f601ee-51c3-4133-aece-b5571a7d8002` | Explicit New call gave a separate tentative receipt for `8pgqd6bsb7rvphl`, retained after hang-up and reload. Requests and Schedule updated live. Owner review showed David Beispiel, Kastanienallee 13, 26 Sept 2026 11:00–13:00 Berlin, regular cleaning, €21 budget below €50 minimum, warning and no agreed price. Owner Decline moved it to History; it disappeared from Schedule while A stayed confirmed. | Submission `0b558cc0-d576-48a5-9c48-91f96948f61c`; `verify_demo_booking.py --status declined --count 2 --budget low` passed. One ledger save attempt, matching voice-call source and reviewed payload; original tentative receipt unchanged; unrelated owner read/decision denied. |

Both calls used distinct room and submission identities. The browser showed one
saved receipt per call. The worker log showed actual microphone input and German
assistant output for the private rooms. A post-hangup publisher-channel warning
appeared in the worker log; it did not affect either saved receipt or decision.

A third spoken call `591b01fe-a67c-4e0c-b6c9-f8a559781695` exercised hang-up
and same-tab reload, but did **not** establish the intended interrupted valid
save. Its reviewed summary omitted the required duration; the worker nevertheless
called `create_booking` with `estimated_hours: null` at 10:18:32 local time. The
caller hung up about five seconds later. The call ledger records one authoritative
rejection for submission `39c7ddf0-0576-422a-9a65-ee989a09e7a6`, and the
reloaded caller correctly said the request was not saved. The database still has
exactly the two earlier bookings, both reverified with their original decisions.
This is a real agent validation gap, not evidence for lost-response reconciliation.
The candidate now rejects a missing/nonpositive duration in the speech tool
before any save cue or network submission, instructing the assistant to ask for
duration and obtain a new complete approval. A focused regression failed before
that change and passed afterward; the browser-worker test file passed 39 cases.

For a separate retest, the corrected working tree was copied into a second fresh
private stack at `/private/tmp/yoshida-acceptance-node24-retest-20260923`, with
PocketBase `:8094`, caller `:3032` and dashboard `:3033`. The copied worker has
the duration guard and registered; the caller opened at Bereit with no request.
The `ready.json` commit field identifies the last commit before the duration
fix; the retest used the corrected working-tree candidate, which was subsequently
committed. Both frontend listener processes loaded
the Node.js 24.21.0 executable, verified from their open binary path.
The user then completed one more fictional German call,
`a39681b4-3055-44f6-a7a8-4fb577c4c5c1`. They reported approving a complete
summary that included two hours, then hanging up during the spoken save cue. The
worker invoked `create_booking` at 10:31:13 local time with `estimated_hours: 2`
and a known €60 budget; the caller disconnected at 10:31:15 while the worker was
still handling the tool reply, which it dropped after disconnect. The ledger
settled to `saved` with one attempt and submission
`03b9e56d-43a7-4022-a419-f5fc4365446b`. The same caller tab showed the
tentative receipt `a14f30mv9bokvgw` immediately after hang-up and again after
reload. The new database contains exactly one request, matching the frozen
reviewed details, and the unrelated cleaner is denied reads and decisions.
`verify_demo_booking.py --status requested --count 1 --budget known
--allow-empty-notes` passed. This scenario intentionally had no notes. The
verifier gained that explicit option and a known-above-minimum budget mode;
the normal A/B checks still require notes.

Stopping the first stack with a repeated interrupt exposed a launcher cleanup
gap: the launcher exited during teardown, leaving its three loopback listeners.
Those exact process groups were identified and stopped, without touching other
services. The launcher now ignores further termination interrupts only while
its owned process groups are being stopped.
The Node.js 24 retest stack was also stopped by signalling its four identified
private process groups. Its launcher reported a permission error while trying
to signal those already terminated groups from the managed shell; a follow-up
listener and worker-log-file check found no remaining test processes. Both
private data directories remain available for local evidence inspection.

The first live launcher inherited local Node.js 26.5.0. The specified Node.js
24.21.0 runtime passed dashboard 52 tests, lint and webpack production
build/typecheck; caller 26 tests, lint and webpack production build/typecheck;
and PocketBase 9 JavaScript tests. After the duration and verifier changes, the
final agent suite passed 80 tests with 3 opt-in skips, Ruff passed, and the real
PocketBase HTTP suite passed 13 tests.

At 375×812 in the live dashboard, arrow keys changed the selected request tab,
Enter opened the review, and Escape closed it and returned a visible keyboard
focus ring to the originating request. No horizontal overflow appeared. Measured
visible text contrast in the sampled Requests headings, tabs, labels, actions,
links and status text was at least 6.84:1 in dark mode and 5.25:1 in light mode.
Sampled visible caller headings, explanatory text and controls measured at least
5.69:1.
At a 320px CSS viewport, the saved caller receipt and live Requests/Schedule
pages had no document-level horizontal overflow. The first Requests capture
showed overlapping status labels. Stacking the label and count only below 360px
fixed the overlap; the live dashboard copy received that CSS change after stack
startup for visual recheck. The three Schedule modes each kept a 282px outer
calendar region and 320px document width, with wider Week/Month content confined
to the calendar's own scroll area. The actual browser zoom shortcut still did not
change viewport scale, so this is reflow evidence rather than a literal 200%
zoom observation.
The mobile light view was captured and compared visually with the approved Fluid
reference. These observations do not establish whole-app contrast. The user
explicitly removed VoiceOver from this demo's acceptance scope on 23 Sept 2026;
no screen-reader output is claimed. They also accepted the earlier Confirm/Decline
pair plus the corrected Node.js 24 interruption retest as sufficient spoken
evidence for this demo, without repeating the pair on the final candidate.
They also accepted the 320px CSS reflow check in place of literal 200% browser
zoom for the demo.

## Demo acceptance and formal limits

The first two live calls used separate rooms; the second began through the
explicit New call action. Preserved worker logs show exactly one distinct worker
job ID for each of those rooms and for both later test rooms. Controlled tests
also cover repeated starts and worker selection. The Node.js 24 retest covered
hang-up during the save cue, a dropped worker tool reply, one persisted
submission and same-tab receipt recovery.

The user accepted the observed A/B pair, corrected Node.js 24 interruption
retest, 320px CSS reflow and representative focus/contrast checks as sufficient
for this local demo. A literal 200% browser zoom, whole-app measured contrast,
full keyboard/focus traversal, long error content, reduced motion and real
screen-reader output were not observed. The in-app browser zoom shortcuts did
not change its viewport; native Codex app access for a zoom workaround was
rejected by automatic approval review. VoiceOver was explicitly excluded from
this demo by the user. No broader accessibility claim is made.

The Confirm/Decline pair ran on Node.js 26.5.0 and the earlier committed
candidate. The corrected working-tree candidate had one spoken Node.js 24
interruption call. A strict two-call Confirm/Decline repetition on the final
committed candidate and Node.js 24 has not been performed; the user accepted
this combined evidence for the demo.

The original strict #40/#34 criteria still exceed this user-scoped demo evidence;
ticket #40 and parent #35 have not been closed. No deployment, telephone
integration or showcase publication is implied by these local checks.
