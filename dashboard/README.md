# CleanVoice dashboard

Next.js cleaner UI: user login, bookings, calendar, and business preferences. The dashboard communicates with PocketBase over HTTP and browser realtime; it does not join a LiveKit room.

From this directory:

```sh
npm ci
npm test
npm run lint
npm run build
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3001
```

The login page renders without PocketBase. Login, bookings, settings, and realtime require the team's missing custom backend/schema and a synthetic user linked to a cleaner record. There is no mock-data fallback. See [setup](../docs/setup.md) and the [backend contract](../docs/backend-contract.md). Tests here inspect source contracts; they do not verify a live database or access rules.
