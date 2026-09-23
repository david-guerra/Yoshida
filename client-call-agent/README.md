# Yoshida caller agent

Python LiveKit worker derived from the [LiveKit agent starter](https://github.com/livekit-examples/agent-starter-python). The project-specific layers are the caller prompt, PocketBase context preload and booking tools, and the voice demo flow. See the [upstream notice](../licenses/livekit-agent-starter-MIT.txt) and [team attribution](../README.md#team-and-provenance).

From this directory:

```sh
uv sync --frozen --dev --python 3.12
uv run --frozen pytest -q
uv run --frozen ruff check .
uv run --frozen ruff format --check .
```

Offline tests inject synthetic SDK credentials. Three network/model evaluations remain skipped unless `RUN_LIVEKIT_EVALS=1`; enabling them needs your credentials and can incur provider charges.

For an explicitly configured local demo:

```sh
cp .env.example .env.local
# Fill the required variables described in ../docs/setup.md.
uv run --frozen src/agent.py download-files
uv run --frozen src/agent.py dev
```

Run from this directory so `.env.local` is loaded. The worker registers as `client-call-agent` and is dispatched by `web-caller`. Backend access defaults to loopback; the required custom PocketBase routes and schema setup are in `../pocketbase/`. Read [setup](../docs/setup.md) and [backend contract](../docs/backend-contract.md) first. The Dockerfile is inherited deployment scaffolding and is not covered by local demo verification.


## Speech and browser call recovery

German speech defaults to LiveKit Inference `cartesia/sonic-3.5` with the pinned
stock voice. `LIVEKIT_INFERENCE_TTS_MODEL` and
`LIVEKIT_INFERENCE_TTS_VOICE` override these defaults; leave them unset to use the
defaults. Empty values and retired inference routes fail before synthesis. The
worker uses LiveKit credentials, including the SDK's optional
`LIVEKIT_INFERENCE_API_KEY` / `LIVEKIT_INFERENCE_API_SECRET` overrides.
`ELEVENLABS_VOICE_ID` is no longer used.

Run a standalone synthesis probe only when provider access is intended:

```sh
uv run --frozen src/speech_probe.py --run
```

The probe sends one short German sentence, checks for nonempty/nonzero PCM,
prints aggregate JSON, and closes its stream, TTS connection and HTTP session.
It allows 10 seconds for synthesis and 25 seconds overall, with no retries.
Passing this probe is **not** evidence of a complete browser conversation.

Browser dispatch metadata carries the call identity, worker capability and fixed
submission reference. The worker checks that call before and after joining;
`yoshida.call_id` and `yoshida.ready` identify its readiness. First speech playback
is a separate browser check. Background typing audio is disabled. Lookup events
and sanitized speech errors reach the caller server as well as room attributes.

Reviewed browser submissions go through the caller server, which owns durable
receipt recovery. Save requests allow 10 seconds per attempt and one same-payload
retry. Once started, they survive interrupted speech and drain during job shutdown;
the server remains authoritative after worker loss. Lookup HTTP attempts allow
5 seconds and one retry for transient errors. STT/TTS gateway retries are disabled;
the SDK stream may retry once. LLM turns are never automatically replayed.
Late preload changes instructions for the next natural boundary without another
greeting or forced briefing.
