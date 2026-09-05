# CleanVoice Public Showcase Cleanup Plan

> **For agentic workers:** Execute this checklist in order; use superpowers:executing-plans for inline execution. Do not publish unconfirmed attribution or force-push history.

**Goal:** Prepare the existing public prototype for an accurate, privacy-conscious portfolio showcase.
**Architecture:** Retain the caller, Python agent, and dashboard. Preserve David's 18 newer local commits, including the actual PocketBase backend; replace unsafe defaults and misleading setup documentation.
**Tech stack:** Next.js 16, React 19, Python 3.12, uv, LiveKit, PocketBase 0.39.4.
**Spec:** https://github.com/david-guerra/CleanVoice/issues/2 (handoff from portfolio #29).

## Global constraints

- Confirm ownership, preferred credits, publication rights, and license with David.
- Never copy private contact values or credentials into public audit reports.
- Backup before rewriting history; credential rotation and collaborator coordination precede any approved force-push.
- Add the portfolio source link only after publication, privacy, and reproducibility gates pass.

## Tasks

- [x] Create and cross-link the destination issue before changes.
- [x] Clone anonymously, create an isolated cleanup branch, mirror all advertised refs, and verify a recovery bundle.
- [x] Scan full reachable history with Gitleaks and inspect contact/config/media candidates separately.
- [x] Enable GitHub secret scanning and push protection; record the effective returned settings.
- [x] Sanitize tracked fixtures/configuration, default backend access to loopback, and redact personal data from preload failures. Add behavioral regression tests before changing error handling/defaults.
- [x] Repair the caller lockfile using the existing package manifest; verify `npm ci` succeeds without upgrading direct dependencies.
- [x] Replace root/component starter documentation, align agent instructions to the actual layout, document environment names, backend contracts, provenance, and limitations.
- [ ] Replace inactive nested template workflows with root offline checks; add dependency updates and suitable branch protections.
- [ ] Run frontend tests/lint/build and agent offline tests/lint. Scan the final tree and review the diff.
- [x] Confirm team/media rights and history contact provenance. David confirmed fictional data and publication permission; no public rewrite is indicated. MIT approved.
- [x] Restore the actual backend, verify synthetic booking creation and live dashboard refresh, and add approved MIT license/credits/media.
- [ ] Publish the cleanup and passing CI, verify an anonymous clone, then add the portfolio source link. Live paid voice evaluations remain outside this cleanup verification.

## Initial evidence and limits

Main starts at `46cc942396a221514c96e0ec3e88ef4f35d627b2`; the other advertised branch is `demo-working-version` at `0520b50e66172aff0bc7c0370de81bbbe89c22b7`. Seven commits and 125 unique blobs were inspected. Gitleaks 8.30.1 reported no secrets. Initial publication questions were resolved by David during the session. The local checkout supplied the backend. See `docs/showcase-audit.md` for final evidence and limitations.
