# Yoshida agent instructions

Read `README.md`, `docs/setup.md`, and `docs/backend-contract.md` before changes. The canonical project name is Yoshida. This is a team hackathon prototype for supervised local demos, not a production service.

## Layout and verification

- `client-call-agent/`: Python LiveKit worker; use uv and its component instructions.
- `web-caller/`: Next.js caller, token route, named worker dispatch.
- `dashboard/`: Next.js cleaner dashboard; it reads PocketBase and does not join LiveKit.
- `pocketbase/`: custom hooks and fresh schema setup; exclude runtime databases, migrations generated from local data, and binaries. Setup is tested on PocketBase 0.39.4.
- Run each frontend's `npm test`, `npm run lint`, and `npm run build`.
- From `client-call-agent/`, run `uv run --frozen pytest -q`, `uv run --frozen ruff check .`, and `uv run --frozen ruff format --check .`.
- Read component `AGENTS.md` files before modifying those components. Query current LiveKit docs through its MCP before changing LiveKit API integration.

## Product and privacy rules

- The agent must use stored business facts; it must not invent prices, service areas, availability, or a confirmed booking.
- Every booking remains tentative until a human confirms. The backend writes `requested`; preserve that boundary.
- Keep secrets server-side. Use component `.env.local` files; commit only empty/synthetic `.env.example` templates.
- Default backend access to loopback. Never commit personal tunnel addresses, customer contacts, access codes, audio, transcripts, or database exports.
- Use fictional reserved phone identities and clearly synthetic names in examples; never infer publication consent from public Git history.
- Describe individual contributions only after confirmation. Distinguish starter/template work from team work.
- Follow `docs/showcase-audit.md` before publishing a source link. History rewriting needs a verified private backup, credential rotation where applicable, collaborator coordination, and David's explicit approval before force-pushing.
