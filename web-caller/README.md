# web-caller/

Browser client that simulates a **person phoning the cleaning service**. It joins a
LiveKit room as the `caller` participant (publishing the mic, playing the agent's audio)
and talks to the Python voice agent in [`../client-call-agent`](../client-call-agent).

Built with Next.js (App Router) + TypeScript + Tailwind, using
[`@livekit/components-react`](https://docs.livekit.io/reference/components/react/) and
`livekit-client`.

## Setup

```bash
cp .env.example .env.local   # then fill in your LiveKit credentials
npm install
npm run dev                  # http://localhost:3000
```

Required env (in `.env.local`):

| Variable                  | Used by         | Notes                                            |
| ------------------------- | --------------- | ------------------------------------------------ |
| `LIVEKIT_API_KEY`         | `/api/token`    | Server-only. Never exposed to the browser.       |
| `LIVEKIT_API_SECRET`      | `/api/token`    | Server-only.                                     |
| `NEXT_PUBLIC_LIVEKIT_URL` | browser client  | The `wss://` URL the caller connects to.         |

## How it works

- [`app/page.tsx`](app/page.tsx) — "Start call" fetches a token from `/api/token`, then
  mounts `<LiveKitRoom audio video={false}>`. `<RoomAudioRenderer>` plays the agent's
  voice; `<CallSession>` shows connection state and a mute / end-call control.
- [`app/api/token/route.ts`](app/api/token/route.ts) — mints a LiveKit access token with
  `livekit-server-sdk` for a given `room` + `identity`.

Both the caller and the agent must join the same room (`demo-call`, per the project brief in [../CLAUDE.md](../CLAUDE.md)).
