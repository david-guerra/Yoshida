# Approved UI implementation verification

Date: 2026-09-22

Ticket: #38, Apply the approved prototype to the running dashboard
Reference: #31 final Fluid prototype, Good Company 2D identity

## Candidate and setup

The working tree was tested against a disposable PocketBase 0.39.4 data directory created by `pocketbase/tests/serve_read_demo.py`. The verified cleaner was the synthetic `cleaner@example.test` account. Existing environment files and PocketBase data were not changed.

The reference prototype and running application were compared in the in-app browser at desktop size and at 375 × 812. Both dark and light themes were inspected. The 375px layout and the browser's zoom path through 200% had no horizontal document overflow. Reduced-motion rules disable transitions and animations when requested.

## Runtime evidence

- The request inbox loaded 32 real synthetic requests, searched across records beyond the first PocketBase page, paginated six rows at a time, and preserved stable panel geometry while switching Needs review, Upcoming, and History.
- Request `ou7jcdmu0xt05v4` was reviewed in the real drawer and confirmed through the authenticated owner decision endpoint. PocketBase returned persisted status `confirmed`; the request left Needs review, appeared in Upcoming, and appeared in Schedule without inventing an agreed price.
- Request `jakunej4piv15mi` was reviewed at 375px and declined through the same endpoint. PocketBase returned persisted status `declined`; the drawer returned focus to the list heading and the request appeared in History.
- The review showed the complete address, Europe/Berlin appointment, service, duration, caller budget, distinct agreed price, call summary, cleaner briefing, access details, and both translated and original note text. A disposable autumn clock-overlap request displayed the reviewed local instant as `31 Oct 2027, 02:30 (UTC+01:00) · Europe/Berlin`, preserving the caller's explicit offset.
- Confirm and Decline from the full-page review returned to Upcoming and History respectively, with the persisted record and saved-decision announcement visible in the destination inbox. The decision status region remains mounted with polite, atomic semantics so pending, failure, uncertainty, and saved messages use one stable announcement target.
- Agenda, Week, and Month used the same authenticated records. Confirmed and tentative requests remained visually distinct, and the calendar's outer height stayed stable across view changes apart from sub-pixel rounding.
- A controlled 503 on booking reads produced an honest initial error with no invented data. A later 503 retained the last complete Schedule with `Updates paused`. Clearing the fault and choosing Retry restored `Live`.
- Keyboard arrow navigation moved between request status tabs. Escape/close behavior, focus return, mobile full-screen review, visible focus, live status announcements, long content wrapping, and fixed-height internal scrolling were exercised.
- The German caller surface rendered separately at desktop and 375px, kept the real call and durable receipt state machine, and used the approved tentative-request wording. Live microphone/provider behavior remains covered by the earlier #39 verification and was not rerun for this UI-only ticket.

## Automated checks

```text
dashboard: 52 tests passed; lint passed
web-caller: 26 tests passed; lint passed
client-call-agent: 75 tests passed, 3 opt-in provider tests skipped; Ruff checks passed
PocketBase JavaScript: 9 tests passed
PocketBase HTTP: 13 tests passed
dashboard and web-caller: webpack production builds passed
```

The normal `next build` command selected Turbopack and could not bind its internal worker port in this managed host (`Operation not permitted`). Running the same production builds with `next build --webpack` completed compilation, type checking, static generation, and route collection for both apps.

## Intentional differences from the prototype

- The prototype's preview menu and synthetic-state controls are absent. Loading, failure, stale, partial, pending, unclear, saved, and conflict states come from real application boundaries.
- The sidebar shows the authenticated cleaner and keeps the existing Settings and manual New request flows. Prototype sample names, dates, and test labels are absent.
- Runtime records determine grouping and calendar density. The disposable 31-record fixture intentionally produces a dense future day, so Schedule uses bounded scrolling rather than hiding entries.
- The caller uses the production call lifecycle and receipt identifiers. It does not reproduce the prototype's in-memory walkthrough controls.
- No new showcase media was committed. Polished public captures remain scoped to the separate showcase work after integrated acceptance.
