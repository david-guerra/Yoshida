# Integrated local acceptance

Runbook for [#40](https://github.com/david-guerra/Yoshida/issues/40), following the
[approved M1 gate](https://github.com/david-guerra/Yoshida/issues/34#issuecomment-5652888005).
The final result requires two real German browser calls, persisted owner decisions,
failure/authorization checks and accessibility verification. A speech probe, manual
request, HTTP assertion or passing component suite alone does not complete this gate.

## Start a private stack

Install the locked dependencies and PocketBase 0.39.4 using [setup](setup.md). Use
Node.js 24 and the agent's Python 3.12 environment. From the repository root:

```sh
uv run --directory client-call-agent --frozen python ../scripts/local_demo.py
```

This starts PocketBase on `127.0.0.1:8090`, caller on `127.0.0.1:3000`, dashboard on
`127.0.0.1:3001`, downloads worker assets and starts the named worker in `dev` mode.
The default connects to the configured speech project. Only run it when live-provider
use is intended. Ensure no other `client-call-agent` worker is registered in that
same LiveKit project; worker selection is shared by agent name. The launcher does
not stop existing workers or services.

For local checks without starting a worker, or when default ports are occupied:

```sh
uv run --directory client-call-agent --frozen python ../scripts/local_demo.py \
  --without-worker --pocketbase-port 8092 --caller-port 3020 --dashboard-port 3021
```

`--backend-only` starts just the empty synthetic database. `--run-dir /absolute/new/path`
chooses a new output directory; an existing directory is rejected. Occupied ports
fail before creating data. Ctrl-C stops only the process groups created by this run.
All run data is retained for inspection; no resume or cleanup of old databases is automatic.

The private directory printed on startup contains:

- `ready.json`: candidate commit, origins, owner IDs and worker-start status. A
  started worker is not proof of registration, successful audio or live acceptance.
- `login.json`: generated passwords for `cleaner@example.test`, `other@example.test`
  and the local setup administrator. Open locally; do not attach this file to an issue.
- `data/`, `migrations/`, `calls.sqlite`: fresh backend and private caller ledger.
  The ledger is created when the caller API first needs it.
- Separate private logs and frontend/worker source copies. Review and sanitize any
  evidence before sharing; worker logs can contain synthetic conversation content.

Existing environment files and databases remain untouched. The frontend and worker
copies inherit their configured local provider settings, with explicit loopback backend,
callback, caller identity and ledger overrides. All dashboard admin aliases are blank,
so review uses normal cleaner authentication. Changes to the source after startup
require a new run to test that candidate. Use the same LiveKit project credentials
in caller and worker. The configured cleaner has English review and a €50 minimum;
the other owner exists only for access-negative checks. There are initially no bookings.

## Required checks before calls

Run from the repository root (the final full suite is run once for a candidate):

```sh
npm --prefix dashboard test
npm --prefix dashboard run lint
npm --prefix dashboard run build
npm --prefix web-caller test
npm --prefix web-caller run lint
npm --prefix web-caller run build
uv run --directory client-call-agent --frozen pytest -q
uv run --directory client-call-agent --frozen ruff check .
uv run --directory client-call-agent --frozen ruff format --check .
node --test pocketbase/tests/*.test.mjs
python3 -m unittest discover -s pocketbase/tests -p 'test_booking*http.py' -v
uv run --directory client-call-agent --frozen python -m unittest discover -s ../scripts/tests -v
python3 -m py_compile pocketbase/setup_pb.py scripts/local_demo.py scripts/verify_demo_booking.py
```

The launcher integration tests start their own backend and frontend processes with
no worker. They verify empty owner-scoped reads, a real saved request and inspector,
stale-cookie sign-in recovery, isolated source copies, port release and preserved data.
If Turbopack is prohibited from starting its internal workers on a managed host,
record that limitation and use `npm --prefix dashboard run build -- --webpack` and
the equivalent caller command. Do not silently label a failed build as passed.

## A — German request, unknown budget, Confirm

Open the caller URL from `ready.json` and sign into the dashboard URL as
`cleaner@example.test`. Keep Requests open before calling to observe realtime arrival.
Choose a future, unambiguous Europe/Berlin date when running this scenario. Use these
fictional details, substituting that date in the spoken line:

> Guten Tag, ich heiße Anna Beispiel. Ich möchte eine normale Reinigung am
> [Datum] um zehn Uhr für zwei Stunden buchen. Die Adresse ist Testweg zwölf,
> Hinterhaus, dritte Etage links, 10115 Berlin, Deutschland. Bitte besonders
> die Küche reinigen. Ein Budget habe ich noch nicht festgelegt.

The caller lookup identity is `+12025550102`, from the reserved fictional range.
Do not speak or enter real customer details. Omit one required detail initially to
verify the agent asks for it. Correct one detail before approving the complete
summary. Allow the microphone and verify actual two-way speech. Only explicitly
approve when the summary matches the intended request.

Expected: one **Anfrage gespeichert** tentative receipt, never cleaner-confirmed
wording. Record the booking ID; hang up and reload the same caller tab. Its receipt
must remain. Open the realtime request in the English dashboard and compare full
address, Berlin time, duration, service, original and translated note, unknown budget
and unknown agreed price. Confirm, reload, and check Upcoming plus Schedule.

Set `YOSHIDA_RUN_DIR` to the printed private run path and `YOSHIDA_BOOKING_A` to the
actual receipt ID, then verify:

```sh
uv run --directory client-call-agent --frozen python ../scripts/verify_demo_booking.py \
  --run-dir "$YOSHIDA_RUN_DIR" --booking "$YOSHIDA_BOOKING_A" \
  --status confirmed --count 1 --budget unknown
```

## B — new German request, low budget, Decline

Start an explicit new call and use a different future appointment and fictional name:

> Ich heiße Bruno Beispiel. Ich möchte eine normale Reinigung am [anderes Datum]
> um elf Uhr für zwei Stunden. Die Adresse ist Testweg zwölf, 10115 Berlin,
> Deutschland. Mein Budget beträgt zwanzig Euro. Bitte besonders die Küche reinigen.

Review and explicitly approve. Expect a different call/room/submission and exactly
one additional tentative receipt. The €20 budget must warn that it is below the €50
minimum, without automatic rejection. Review completely and Decline as the owner.
Reload: the new request belongs in History, is excluded from Schedule, and request A
remains confirmed. Set `YOSHIDA_BOOKING_B` to the second receipt ID:

```sh
uv run --directory client-call-agent --frozen python ../scripts/verify_demo_booking.py \
  --run-dir "$YOSHIDA_RUN_DIR" --booking "$YOSHIDA_BOOKING_B" \
  --status declined --count 2 --budget low
uv run --directory client-call-agent --frozen python ../scripts/verify_demo_booking.py \
  --run-dir "$YOSHIDA_RUN_DIR" --booking "$YOSHIDA_BOOKING_A" \
  --status confirmed --count 2 --budget unknown
```

The verifier checks normal-owner reads, exact database/submission counts, complete
reviewed intake and notes, unknown agreed price, immutable tentative receipt,
unrelated-owner read/decision rejection, and the matching saved browser ledger entry.
It does not prove speech, correct transcription, translation quality or screen behavior.
`--source dashboard` deliberately identifies controlled/manual requests and omits the
voice-ledger assertion; never use it to claim scenarios A/B passed.
For an additional diagnostic call with a known budget at or above the cleaner's
minimum, use `--budget known`. If that reviewed call intentionally has no booking
notes, add `--allow-empty-notes`; the A/B checks above keep requiring notes.

## Failure and access checks

These targeted commands are repeatable fault controls at the existing boundaries;
they can be rerun while diagnosing a failure without rerunning the entire suite:

| Cases | Command from repository root | Evidence type |
| --- | --- | --- |
| Lost response after commit, server restart, original receipt, no duplicate | `node --test --test-name-pattern='lost save\|interrupted save\|process restart' web-caller/tests/call-service.test.mjs` | Durable SQLite service with controlled transport |
| Microphone cancellation, actual playback readiness, autoplay blocking, deadlines, reload recovery and late events | `node --test web-caller/tests/call-session.test.mjs` | Browser lifecycle with controlled media/transport |
| Concurrent starts, ambiguous dispatch, fixed identities, private capabilities | `node --test web-caller/tests/call-service.test.mjs` | Call-service boundary |
| Frozen reviewed payload, interrupted tool, speech/provider failures, no replay | `uv run --directory client-call-agent --frozen pytest tests/test_submission.py tests/test_browser_worker.py -q` | Worker/tool boundaries with doubles |
| Rollback, Berlin gaps/overlaps, missing/inactive cleaner, concurrent retries, opposing decisions, bypass attempts and real lost HTTP response | `python3 -m unittest discover -s pocketbase/tests -p 'test_booking_http.py' -v` | Real disposable PocketBase HTTP |
| More than 30 records/notes, related reads and event ownership | `python3 -m unittest discover -s pocketbase/tests -p 'test_booking_reads_http.py' -v` | Real disposable PocketBase HTTP/SSE |
| Initial/refresh/partial failures, delayed old responses, expired/switched account, subscription recovery | `node --test dashboard/tests/booking-reads.test.mjs dashboard/tests/booking-realtime.test.mjs` | Controlled read/subscription boundaries |

For repeatable browser read faults, use `pocketbase/tests/serve_read_demo.py` as
documented in [read verification](booking-read-verification.md); its stdin accepts
`{"fault":{"path":"/api/collections/bookings/records","status":503}}` and
`{"fault":{"path":""}}` to recover. It has its own disposable fixture and must not
be counted as either live call. The actual caller must also demonstrate hang-up
during saving and same-tab reload reconciliation; controlled tests alone do not
establish that browser observation.

## Browser and accessibility gate

Compare the real apps with [the approved final reference](https://github.com/david-guerra/Yoshida/issues/31#issuecomment-5652848963)
at 1280×900 and 375×812 in dark and light themes. Record intentional differences.
Exercise Requests tabs/search/pagination, full review, all Schedule modes, and both
decision outcomes. Verify keyboard-only operation, visible focus, Escape and drawer
focus return, 200% zoom/reflow, long addresses/notes/errors without clipping, measured
text/control contrast, meaningful screen-reader pending/error/saved/recovery
announcements, and reduced motion. DOM live-region attributes alone do not prove
screen-reader announcements. Keep unchecked items pending.

Record date, commit (and any uncommitted changes), dependency/browser/OS versions,
commands, synthetic call/submission/booking IDs, persisted assertions, screenshots,
failure outcomes and remaining gaps. Stop the stack with Ctrl-C. Local acceptance
does not authorize public deployment, telephone integration or showcase publication.
