# CleanVoice Public Showcase Cleanup Plan

> **For agentic workers:** Execute this checklist in order; use superpowers:executing-plans for inline execution. Do not publish unconfirmed attribution or force-push history.

**Goal:** Prepare the existing public prototype for an accurate, privacy-conscious portfolio showcase.
**Architecture:** Retain the caller, Python agent, and dashboard. Replace unsafe defaults and misleading setup documentation without inventing the missing PocketBase backend.
**Tech stack:** Next.js 16, React 19, Python 3.12, uv, LiveKit, externally supplied PocketBase.
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
- [ ] Sanitize tracked fixtures/configuration, default backend access to loopback, and redact personal data from preload failures. Add behavioral regression tests before changing error handling/defaults.
- [ ] Repair the caller lockfile using the existing package manifest; verify `npm ci` succeeds without upgrading direct dependencies.
- [ ] Replace root/component starter documentation, align agent instructions to the actual layout, document environment names, backend contracts, provenance, and limitations.
- [ ] Replace inactive nested template workflows with root offline checks; add dependency updates and suitable branch protections.
- [ ] Run frontend tests/lint/build and agent offline tests/lint. Scan the final tree and review the diff.
- [ ] Confirm team/media rights and history contact provenance. Decide whether a rewrite is required and seek explicit force-push approval only after preparing a concrete recovery/coordination plan.
- [ ] Restore the actual backend, verify the synthetic call-to-dashboard flow, choose the approved license, publish approved credits/media, then add the portfolio source link.

## Initial evidence and limits

Main starts at `46cc942396a221514c96e0ec3e88ef4f35d627b2`; the other advertised branch is `demo-working-version` at `0520b50e66172aff0bc7c0370de81bbbe89c22b7`. Seven commits and 125 unique blobs were inspected. Gitleaks 8.30.1 reported no secrets. Historical realistic contact records and design-media rights remain unconfirmed. The custom PocketBase backend is absent. These are release gates, not evidence of completion.
