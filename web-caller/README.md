# CleanVoice browser caller

Next.js microphone/audio UI for a supervised local LiveKit demo. The server mints a short-lived token and dispatches `client-call-agent`; the browser joins `demo-call` as `caller`.

From this directory:

```sh
npm ci
npm test
npm run lint
npm run build
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The UI renders without credentials. A call requires your own LiveKit project, a running agent, and the separate PocketBase backend for booking tools. Configure `NEXT_PUBLIC_LIVEKIT_URL` before building. Keep API key/secret server-only. See [setup](../docs/setup.md).

The token/dispatch routes currently lack authentication and rate limiting and use a fixed demo identity. Keep a credentialed instance on loopback. The tests inspect source contracts; they do not make a voice call.
