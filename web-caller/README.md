# Yoshida browser caller

Next.js microphone/audio UI and caller server for a supervised local LiveKit demo. Each explicit start gets a fresh room and browser capability. The server owns LiveKit dispatch, the worker capability, the fixed submission identity, and durable receipt recovery in a private SQLite ledger.

From this directory:

```sh
npm ci
npm test
npm run lint
npm run build
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The UI renders without credentials. A call requires your own LiveKit project, the named `client-call-agent` worker, and the separate PocketBase backend. Configure `NEXT_PUBLIC_LIVEKIT_URL`, `CALL_SERVER_URL`, and `POCKETBASE_URL`; keep API credentials and `CALL_DATABASE_PATH` server-only. The callback origin is deliberately restricted to loopback. See [setup](../docs/setup.md).

The browser must grant microphone access before dispatch. A connected room becomes “Im Gespräch” only after the intended agent is ready and its audio playback starts. Blocked autoplay exposes an “Audio aktivieren” action. Call and save status have bounded retries; an unclear save blocks a new call until the same submission is reconciled. A saved receipt survives hangup, reload, and caller-server restart.

`/api/calls` is capability-authenticated but has no user account, rate limiting, or public deployment hardening. Keep the complete demo on loopback with synthetic data. The obsolete `/api/token` and `/api/dispatch` routes return `410`. Automated tests cover cancellation, dispatch ambiguity, interrupted saves, receipt recovery, and lifecycle deadlines. The [browser voice verification record](../docs/browser-voice-verification.md) records the supervised live run.
