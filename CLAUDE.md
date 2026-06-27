# PROJECT.md — Voice AI Hackathon (telli × LiveKit)

## What we're building

A multilingual voice agent that acts as the front desk for solo, off-platform
cleaners in Germany who don't speak fluent German. A German-speaking client calls;
the agent takes the call **in German**, qualifies and books the job, and writes a
structured result the cleaner reads back **in their own language** (e.g. English).

Positioning: not an assistant, a **business partner** — it doesn't just take
messages, it qualifies, books, remembers clients, and surfaces decisions
("this lead fits your area/rate", "this client is lapsing"). For a non-German-
speaking cleaner the language gap is a wall to the whole market; the agent is the
thing that lets them take German clients at all.

## Hackathon scope (what we demo)

We simulate a phone call with **two browser apps joining one LiveKit room**:

- `web-caller` — the client placing the call (mic in, agent audio out)
- `web-cleaner` — the cleaner's view: shows the structured job + history, live
  The agent is a third participant in the same room.

Demo moment: caller talks to the agent in German → agent qualifies + books →
the cleaner-view card fills in live, in the cleaner's language.

## Architecture

web-caller (browser) ─┐

├─► LiveKit room ◄─► agent (Python, LiveKit Agents)

web-cleaner (browser) ─┘ │ tools

▼

PocketBase (HTTP API + realtime)

▲

web-cleaner subscribes to PocketBase for live card updates

- **LiveKit** runs the live voice loop (STT→LLM→TTS, turn-taking). Its job ends at hang-up.
- **Agent (Python)** owns the conversation logic and calls tools that read/write PocketBase directly over HTTP.
- **PocketBase** = single Go binary, embedded SQLite, auto REST API + realtime + admin UI. Our only datastore. Runs as its own process.
- **Frontends** = Next.js + TypeScript + Tailwind, App Router. Talk to LiveKit (room) and PocketBase (data) directly. No hand-written backend — there is no FastAPI/Express; the agent owns logic, PocketBase owns data.
- **After-call recommender** (stretch): a separate LLM pass over the record → a take-it/skip/lapsing line on the card.

## Repo layout

- `agent/` — LiveKit Python agent (from agent-starter-python). Tools: lookup_client, save_call, (stretch) escalate_to_human.
- `web-caller/` — Next.js caller app. Joins LiveKit room as the caller.
- `web-cleaner/` — Next.js cleaner view. Joins/reads room + subscribes to PocketBase.
- `pocketbase/` — PocketBase binary + pb_data.

## Conventions

- Language: agent backend in **Python** (LiveKit Agents), frontends in **TypeScript**.
- Run the agent with `dev` (registers as worker, joins the room) — not `console` — so both browsers can share the room.
- Room name is the join key: hardcode `demo-call` everywhere for the demo.
- Shared LiveKit creds (`LIVEKIT_*`) across agent + both apps; same project.
- Browser ↔ LiveKit needs a server-minted token: `/api/token` route signs with API key/secret. Never expose secrets to the browser.
- Env in `.env.local` per app; never commit it. PocketBase URL in `POCKETBASE_URL`.
- The **PocketBase `clients` collection schema is the contract** between the agent's tools and both frontends — agree on it before wiring either side.

## Hard rules (these came from real failures — respect them)

- **No hallucinated facts.** The agent may ONLY assert services/price/area/hours
  explicitly given in its prompt. Anything else → "I'll have the cleaner confirm",
  never a guess. Inventing a service detail creates real liability (Haftung) for
  the cleaner. This is non-negotiable.
- **Commitments come from data, not generation.** Price, what's included, booking
  confirmations come from the cleaner profile + structured fields, not free-form
  LLM text. The LLM drives conversation; data drives commitments.
- **Nothing is binding until a human confirms.** The agent books a _tentative_
  slot; the cleaner approves the structured summary. This is the liability firewall
  and our "humans + AI hand in hand" pillar.
- **Structured facts are keyed lookups, never RAG.** Client records, door codes,
  bookings = exact PocketBase queries. (RAG only ever belongs on unstructured
  transcript history — not in scope for the hackathon.)
- **Keep tools action-shaped and minimal.** A tool is for an action or a fact the
  model can't invent (book, look up, save). Phrasing/judgment is not a tool.

## Build order (don't get ahead of this)

1. Agent talks back + writes a structured object via `save_call` (DONE / verifying).
2. PocketBase `clients` collection live; agent tools read/write it.
3. `web-caller` joins the room and talks to the agent.
4. `web-cleaner` shows the card, updates live from PocketBase.
5. (Stretch) after-call recommender line on the card.
   Cut scope openly; never fake depth. Smallest slice that genuinely works end-to-end.

## Tooling for AI assistants (Codex / Claude Code)

- **Use the LiveKit docs MCP for all LiveKit questions.** Do NOT write LiveKit
  code from memory — query the live docs via MCP and build against the current
  API. The LiveKit Agents API changes; stale/hallucinated methods are the #1
  time sink. When adding tools, wiring rooms, or minting tokens, confirm the API
  against the docs MCP first.
- This repo ships `AGENTS.md` + a LiveKit agent skill in `agent/` — read them
  before touching the agent.
- Prefer the project's existing patterns (the starter's tool/session structure)
  over inventing new ones.
