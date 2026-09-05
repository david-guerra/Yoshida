# CleanVoice caller agent

Python LiveKit worker derived from the [LiveKit agent starter](https://github.com/livekit-examples/agent-starter-python). The project-specific layers are the caller prompt, PocketBase context preload and booking tools, and the voice demo flow. See the [upstream notice](../licenses/livekit-agent-starter-MIT.txt) and [team attribution status](../README.md#team-and-contribution).

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
