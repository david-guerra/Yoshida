# Showcase audit — 2026-09-05

Tracked in [CleanVoice #2](https://github.com/david-guerra/CleanVoice/issues/2), handed off from [portfolio #29](https://github.com/david-guerra/portfolio/issues/29).

## Scope and provenance

The initial anonymous public clone contained seven commits, with `main` at `46cc942396a221514c96e0ec3e88ef4f35d627b2` and `demo-working-version` at `0520b50e66172aff0bc7c0370de81bbbe89c22b7`. Its 125 unique historical blobs were inspected. David's local `main` at `643b6e83fccc0f6b8afb06bd2780c97ebd425be2` supplied 18 additional commits, including PocketBase hooks/schema setup and later UI/agent work. Those commits and authorship are preserved.

David confirmed publication and cleanup permission from the team, identified teammates as `lishiiChan` and `younaorg`, confirmed that historical contacts and design references are fictional and approved, and selected MIT. The README credits the shared work and describes David's original agent work plus subsequent integration across the stack.

## History and working-tree review

- Gitleaks 8.30.1, downloaded from the official release and checksum-verified, reported no secrets in the initial seven-commit history or expanded 26-commit history including the first cleanup commit.
- A separate blob scan covered credential assignments, private-key/token patterns, email/phone data, environment files, provider/tunnel hosts, transcripts/recordings, and database filenames. Findings were manually classified; reports containing candidate locations stayed outside the repository.
- Historical realistic demo contacts and mockup content were confirmed fictional by David. Current phone examples use reserved fictional numbers and seed emails use `example.test`.
- Historical tunnel defaults are removed from the current configuration and prompt. All default backend access is loopback.
- The seed's fixed demo password is replaced with a locally supplied environment variable and is no longer printed. Historical demo credentials must never be reused for an exposed service; if reused anywhere outside a disposable local demo, replace that account's password before exposing it.
- API-error response bodies and caller/cleaner phone numbers no longer enter the agent's preload/language-lookup failure logs or model-visible tool errors.
- No tracked runtime database, private environment file, recording, transcript export, private key, or model weight was found. Binary files were limited to starter favicon/logo assets and fictional mockups. The new screenshot shows only a disposable synthetic database.

These checks are evidence of the reviewed scope, not a guarantee that arbitrary scanner patterns find every secret. Provider secret scanning and push protection provide additional ongoing checks.

## Backup and history decision

Verified private mirror backups and complete Git bundles were created for both the public repository and local checkout before any cleanup rebase. `git fsck` and `git bundle verify` succeeded. The local mirror also preserves unreachable objects; these are not published. The temporary backup location is recorded in the maintainer's local handoff, never committed here.

No public history rewrite is indicated by the confirmed findings, and none was performed. The only rebase repositioned an unpublished cleanup commit onto David's newer local history. No force-push is needed for this cleanup.

If a new finding requires rewriting history: first revoke/rotate affected credentials; inventory all affected refs; agree a push freeze with collaborators; retain and verify a private mirror; prepare a sanitized replacement and re-scan it; obtain David's explicit approval before any force-push. Afterward, coordinate fresh clones/rebases, verify anonymous access, and address cached/PR refs with GitHub as needed. A history rewrite cannot revoke credentials or erase existing copies.

## Verification

- Clean npm installs for both frontends. Caller lockfile repaired for missing transitive entries without upgrading direct dependencies.
- Dashboard: 14 tests, ESLint, TypeScript and production build pass. The realtime regression tests use named PocketBase events and reject failed subscriptions.
- Caller: 13 tests, ESLint, TypeScript and production build pass.
- Agent: 36 offline tests pass, three live model evaluations are skipped; Ruff passes. Offline tests use synthetic credentials and make no provider calls.
- PocketBase: 13 helper/source tests pass; fresh 0.39.4 schema setup and synthetic seed succeed.
- Local HTTP integration: user login, caller identification, preferences, matching stub, tentative booking creation, expanded authenticated reads, translated notes, and cleaner briefing pass.
- Browser: synthetic cleaner login and booking display work; after the realtime fix, a new request appears without reloading. The previous ordinary-message subscription remained stuck on Connecting.

A new paid live voice call and Docker deployment were not exercised. The README describes the voice stack and demo flow without claiming those were revalidated by this cleanup. Matching, multilingual quality, and access isolation remain explicitly limited as described in the README.

## Repository controls

Secret scanning, push protection, private vulnerability reporting, and dependency alerts are enabled. Main-branch protection requires pull requests, passing component checks, and resolved conversations, and blocks force-pushes/deletion, including for administrators. No human approving review is required for this small team repository; CI and resolved discussions are required. GitHub returned validity checks as disabled even when requested; no claim is made that they are active. The cleanup adds root CI for both frontends, the agent, and PocketBase helpers, with read-only permissions and pinned action revisions, plus monthly dependency update configuration. The final export of 117 source files (excluding dependencies and runtime data) also passed Gitleaks with no findings.

The portfolio source link should land after the CleanVoice cleanup is on public `main` and its CI succeeds. Preserve the hackathon-prototype label and do not claim production matching, tenant isolation, or independently validated live speech quality.
