# Local setup

The root README contains clean installation and verification commands. Run commands below from the repository root unless a component is explicitly selected.

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
| Agent tests | `RUN_LIVEKIT_EVALS` | Set to `1` only to intentionally run paid/network model evaluations with your credentials |

Do not put API keys, secrets, or admin passwords in `NEXT_PUBLIC_*`. All values in committed examples are empty or explicitly synthetic/local. Example phone identities use NANPA's reserved fictional 555-0100–0199 block; the US prefix is intentional even though the voice demo is in German. They are lookup keys, not numbers to call.

## UI-only startup

In separate terminals:

```sh
npm --prefix web-caller run dev -- --hostname 127.0.0.1 --port 3000
npm --prefix dashboard run dev -- --hostname 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3000` for the caller or `http://127.0.0.1:3001/login` for the dashboard login. Protected dashboard routes redirect to login. These pages can render without a backend; the repository intentionally does not substitute fake bookings for failed database requests.

## Live demo prerequisites — currently incomplete

First obtain the team's actual PocketBase hooks, migrations/schema, access rules, and a synthetic seed. A stock PocketBase binary alone is insufficient: the custom routes listed in [backend contract](backend-contract.md) are not built in. Do not use the old tunnel from historical commits.

Configure your own LiveKit project and check availability/access for the pinned voice stack. The checked-in worker uses LiveKit Inference with Deepgram Nova-3 STT, the configured LLM, ElevenLabs Flash v2.5 TTS, turn detection, and the ai-coustics plugin. Provider/model availability and account terms are separate from installing the Python SDK.

With a compatible test backend running on loopback and both frontends started:

```sh
cd client-call-agent
uv run --frozen src/agent.py download-files
uv run --frozen src/agent.py dev
```

Use `dev` so the named worker registers for browser dispatch. `console` is a separate local conversation mode and does not verify the browser flow. Choose only synthetic customer details and a permission-cleared voice. Click the caller's call control, speak a German cleaning request, then verify the resulting tentative booking under the correct cleaner account. Verify the realtime event and a manual reload separately, and verify another cleaner cannot read or modify the booking.

Stop the local processes after the demo. Do not deploy the token routes or custom backend publicly until authentication, rate limits, room isolation, access controls, and retention behavior have been implemented and tested.
