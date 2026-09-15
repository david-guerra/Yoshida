# Local setup

The root README contains clean installation and verification commands. Run commands below from the repository root unless a component is explicitly selected.

The project was renamed from CleanVoice to Yoshida. Existing `CLEANVOICE_*` environment variables, `/api/cleanvoice/*` routes, cookie names, and internal identifiers retain their original spelling for compatibility. Use the documented keys exactly as written.

## Environment files

```sh
cp dashboard/.env.example dashboard/.env.local
cp web-caller/.env.example web-caller/.env.local
cp client-call-agent/.env.example client-call-agent/.env.local
```

Next.js loads each application's `.env.local`; the agent loads `.env.local` relative to its working directory. A root `.env` does not configure all three components. Leave optional blank entries commented out: some code distinguishes an unset variable from an empty string.

| Component | Variable | Use |
| --- | --- | --- |
| Caller, agent | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Server-only credentials for your own LiveKit project |
| Agent; optional on caller | `LIVEKIT_URL` | Project WebSocket URL; caller falls back to its public URL |
| Caller | `NEXT_PUBLIC_LIVEKIT_URL` | Browser-visible WebSocket URL; set before building |
| Agent, dashboard | `POCKETBASE_URL` | Backend origin; defaults to loopback |
| Agent | `CLEANVOICE_POCKETBASE_URL` | Optional legacy override taking precedence over `POCKETBASE_URL`; leave unset unless needed |
| Dashboard | `NEXT_PUBLIC_POCKETBASE_URL` | Optional browser-reachable backend origin; falls back to `POCKETBASE_URL` |
| Caller, agent | `SIMULATED_CALLER_PHONE` | Synthetic lookup identity; use the same value in both and in the test backend |
| Agent | `LIVEKIT_INFERENCE_LLM_MODEL` | Optional model override; code currently defaults to `deepseek-ai/deepseek-v4-pro` |
| Agent | `ELEVENLABS_VOICE_ID` | Optional approved voice identifier |
| Dashboard | `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` | Optional legacy server-only superuser fallback; unnecessary for properly configured cleaner-user rules |
| Dashboard | `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` | Legacy aliases for the preceding values; prefer the `PB_ADMIN_*` names |
| Backend server | `CLEANVOICE_CLEANER_ID` | Seeded active synthetic cleaner record ID; required for new submissions and suggestions |
| Backend setup | `CLEANVOICE_DEMO_PASSWORD` | Password you supply for the synthetic `cleaner@example.test` login; never committed or printed |
| Backend setup | `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` | Local PocketBase superuser for creating the schema |
| Agent tests | `RUN_LIVEKIT_EVALS` | Set to `1` only to intentionally run paid/network model evaluations with your credentials |

Do not put API keys, secrets, or admin passwords in `NEXT_PUBLIC_*`. All values in committed examples are empty or explicitly synthetic/local. Example phone identities use NANPA's reserved fictional 555-0100–0199 block; the US prefix is intentional even though the voice demo is in German. They are lookup keys, not numbers to call.

## UI-only startup

In separate terminals:

```sh
npm --prefix web-caller run dev -- --hostname 127.0.0.1 --port 3000
npm --prefix dashboard run dev -- --hostname 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3000` for the caller or `http://127.0.0.1:3001/login` for the dashboard login. Protected dashboard routes redirect to login. These pages can render without a backend; the repository intentionally does not substitute fake bookings for failed database requests.

## Fresh synthetic backend

Download [PocketBase 0.39.4](https://github.com/pocketbase/pocketbase/releases/tag/v0.39.4) for your OS from the official release, extract its executable to `pocketbase/pocketbase`, and retain its bundled license locally. The binary and database are ignored by Git. The schema setup was tested against exactly this version.

Use a **new disposable data directory** for initial setup and testing. Setup now reconciles fields, indexes and access rules on existing collections without deleting records. For an upgrade, stop callers and use a disposable copy first; a failed schema step leaves affected access rules locked until setup completes successfully. Generated local migrations are not the upgrade authority: rerun `setup_pb.py`.

In a shell, create disposable data and migration directories with `mktemp -d`, saving their paths as `YOSHIDA_DATA_DIR` and `YOSHIDA_MIGRATIONS_DIR`. Set `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, and `CLEANVOICE_DEMO_PASSWORD` locally. Use `admin@example.test` for the admin email and distinct generated passwords. Do not commit these values. Create the local superuser, then start the server:

```sh
YOSHIDA_DATA_DIR=$(mktemp -d)
YOSHIDA_MIGRATIONS_DIR=$(mktemp -d)
./pocketbase/pocketbase superuser create "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
  --dir "$YOSHIDA_DATA_DIR" --migrationsDir "$YOSHIDA_MIGRATIONS_DIR"
./pocketbase/pocketbase serve --http 127.0.0.1:8090 \
  --dir "$YOSHIDA_DATA_DIR" --hooksDir ./pocketbase/pb_hooks \
  --migrationsDir "$YOSHIDA_MIGRATIONS_DIR"
```

In a second shell with the same three environment variables:

```sh
python3 pocketbase/setup_pb.py
```

This creates eight base collections, uses PocketBase's built-in `users` auth collection, and seeds one synthetic cleaner (`cleaner@example.test`, lookup phone `+12025550101`). Sign in to the dashboard using `CLEANVOICE_DEMO_PASSWORD`. New caller requests use `+12025550102`; no real phone calls are placed to these identifiers.

Setup prints the seeded cleaner ID. Export `CLEANVOICE_CLEANER_ID` with that value and restart the same PocketBase server with the same data/migration directories. Creation refuses missing or inactive configuration rather than selecting another cleaner. Collection reads are owner-scoped and booking mutations use the transactional routes. Caller lookup/briefing routes still require loopback-only operation with synthetic data; full availability or service/location fit is not guaranteed. See [backend contract](backend-contract.md).

Run the repeatable HTTP contract suite without configuring credentials or an existing server:

```sh
python3 -m unittest discover -s pocketbase/tests -p 'test_booking*http.py' -v
```

Home, Orders, Calendar, and booking details share authenticated reads. Orders shows 30 records per page; Home and Calendar fetch their complete matching sets. Failed refreshes retain the last successful data with an “Updates paused” label and Retry; an initial failure shows an error. “Live” requires an accepted event subscription and a successful read. Signing out or losing authorization clears private data. Partial detail failures retain readable sections and disable decisions until review is complete.

For repeatable pagination and recovery checks, `python3 pocketbase/tests/serve_read_demo.py` starts a disposable backend with 32 bookings, 31 notes, and 31 preferences, plus a loopback fault proxy. Point both dashboard PocketBase origins at the printed proxy URL. The [verification record](booking-read-verification.md) describes the commands, observed behavior, and remaining delivery boundaries.

## Optional live voice demo

Configure your own LiveKit project and check availability/access for the pinned voice stack. The checked-in worker uses LiveKit Inference with Deepgram Nova-3 STT, the configured LLM, ElevenLabs Flash v2.5 TTS, turn detection, and the ai-coustics plugin. Provider/model availability and account terms are separate from installing the Python SDK.

[LiveKit Agents 1.8.0 release notes](https://github.com/livekit/agents/releases/tag/livekit-agents%401.8.0) report removal of ElevenLabs models from the inference gateway. This project locks Agents 1.7.0 for the dependency security fixes, but an older SDK cannot preserve a retired remote service. Verify the configured TTS route before attempting the voice demo; switching to a supported provider route may be necessary and was not exercised here.

With the synthetic test backend running on loopback and both frontends started:

```sh
cd client-call-agent
uv run --frozen src/agent.py download-files
uv run --frozen src/agent.py dev
```

Use `dev` so the named worker registers for browser dispatch. `console` is a separate local conversation mode and does not verify the browser flow. Choose only synthetic customer details and a permission-cleared voice. Click the caller's call control, speak a German cleaning request, then verify the resulting tentative booking under the correct cleaner account. Verify the realtime event and a manual reload separately, and verify that a second synthetic cleaner cannot read or decide the first cleaner's requests.

Stop the local processes after the demo. Do not deploy the token routes or custom backend publicly until authentication, rate limits, room isolation, access controls, and retention behavior have been implemented and tested.
