# Cleaner-facing target language + latency masking — design

Date: 2026-06-28
Status: approved (pending spec review)

## Problem

The cleaner-facing briefing and order details are not produced in the cleaner's
language. The cleaner's `preferred_language` is resolved correctly throughout the
pipeline, but it is only ever used as a label — nothing translates the actual
text into it. Two concrete gaps:

1. **Booking card / order details.** When a client books, the PocketBase
   create-booking hook assembles `cleaner_briefing` from hardcoded English labels
   (`"Service: "`, `"Location: "`, `"Requested: "`) plus the caller's verbatim
   free-text notes (typically German). `lang` is computed at
   `cleanvoice.pb.js:304` but never applied to the text.
   (`pocketbase/pb_hooks/cleanvoice.pb.js:304-317`)

2. **Cleaner call-in briefing.** When a cleaner calls in, the agent reads back a
   briefing that the hook builds in hardcoded English (`"Hi X. You have N
   upcoming booking(s). Next: ..."`), regardless of the cleaner's
   `preferred_language`. (`pocketbase/pb_hooks/cleanvoice.pb.js:106-117`)

A secondary observation that motivated this work: the live agent is already slow
to respond, so any fix must add **zero** call latency, and the agent should fill
audible gaps during fetch/send operations instead of going silent.

## Why "fetch preferences earlier" is not the fix

For a cleaner call-in, preferences are *already* preloaded at the start of the
call (`preload_call_context`, `client-call-agent/src/agent.py:346-352`). For a
client booking, the cleaner is not known until `suggest_cleaner` matches one
mid-call, so there is nothing to fetch at the start. In both cases the language
value is available where it is needed. The missing piece is a step that renders
the text in that language — not earlier fetching.

## Constraints

- **Zero added call latency.** Translation must fold into generation that already
  happens; no new LLM round-trip on the live path.
- **Honor the project hard rules.** Structured facts (service, time, address,
  price) stay data-driven. The LLM may only *translate* free text the caller
  already provided — never invent or restate commitments.
- **No silence during fetch/send.** A spoken cue plus the existing typing-sound
  filler covers the wait.

## Verified LiveKit APIs (docs MCP, 2026-06-28)

- `ctx.update(message)` — adds a status to the chat context; the framework voices
  it to the user *immediately* at tool start, in parallel with the tool's work.
  Documented to combine with `ctx.with_filler()`.
  (`/agents/logic/tools/async/`)
- `ctx.with_filler(source, delay, interval, max_steps)` — plays audio directly,
  bypassing the LLM. Already used in this project.
- `agent.update_instructions(new_text)` — Python; mutates the active agent's
  instructions in place for STT-LLM-TTS pipelines. The mid-session restriction
  only applies to Gemini realtime, which this project does not use.
  (`/agents/logic/tools/design/`)
- Initial-context / greeting pattern and "load time optimizations"
  (`/agents/logic/external-data/`).

## Design

### A. Booking-card translation — agent inline, hybrid assembly

The briefing has three parts; each is handled where it is safest. No extra LLM
round-trip: the agent supplies the translated fragments inside the
`create_booking` payload it already generates, and that call is already masked by
the typing-sound filler.

| Part | Today | New |
| --- | --- | --- |
| Fixed labels (`Service:`, `Location:`, `Requested:`) | hardcoded English | hook localizes per `cleaner_language` via a label map — deterministic, no LLM |
| Structured values (service_type, start/end time, address) | stored as-is | unchanged — source of truth, never touched |
| Free-text notes (caller's words) | stored + shown verbatim (German) | agent adds `note_translated` (in `cleaner_language`) per note; raw `note` kept for audit; hook renders `note_translated ?? note` |

The hook continues to assemble the briefing string deterministically from
(localized labels + structured field values + translated notes). The LLM only
translates the free-text fragments it already captured. This satisfies "data
drives commitments / no hallucinated facts" while producing fully target-language
output.

- `cleaner_language` is resolved as today: `suggest_cleaner` returns the matched
  cleaner's `preferred_language`; the agent passes it; `create_booking` and
  `enrich_booking_payload_with_cleaner_language` back-fill from the cleaner record
  if absent; default `en`.
- The `service_type` value is an enum; the label `Service:` is localized. Enum
  value localization is optional and out of scope unless trivial via the same map.
- Touch points: caller prompt §Five payload spec; hook
  `pocketbase/pb_hooks/cleanvoice.pb.js:304-317`.

### B. Cleaner call-in briefing — hook templates

Replace the hardcoded English assembly at `cleanvoice.pb.js:106-117` with a
per-language template selected by the cleaner's `preferred_language`. No LLM,
instant. Templates cover the supported languages (`ar, de, en, pl, ru, tr, uk`);
unknown/unsupported falls back to `en`. The template fills in the cleaner name,
upcoming booking count, and next booking service + time from the same structured
fields used today.

### C. Latency masking — spoken cue + typing sound

In `suggest_cleaner` (`agent.py:421-435`) and `create_booking`
(`agent.py:461-476`): add `await ctx.update(...)` so the agent immediately voices
a short, natural German line (for example, "Einen Moment, ich notiere das
kurz.") at tool start. The existing `with_filler` typing sound continues
underneath for the remainder of the wait. Both run concurrently with the
PocketBase call — they fill the existing gap and add nothing to the critical
path. `create_booking` keeps `context.disallow_interruptions()`.

The exact German line is delegated to the LLM via `ctx.update`'s message
instruction so it stays natural and in the conversation's register. If the
generated-line TTS latency proves noticeable in testing, a follow-up optimization
is cached/pre-synthesized TTS for a fixed phrase
(`/agents/multimodality/audio/customization/#cached-tts-in-tools`); not in scope
now.

### D. Pre-greeting gap — greet first, load context in parallel

In `my_agent` (`agent.py:483-546`):

1. Start `preload_call_context(caller_phone)` as an `asyncio` task *before*
   `session.start`, so it runs during model warmup.
2. Build `Assistant` with a "loading" placeholder context.
3. Greet immediately with the generic German opener (valid for any role).
4. `await` the preload task, then call
   `agent.update_instructions(load_caller_agent_prompt(caller_phone, resolved))`.
5. If the resolved role is `cleaner`, follow with a `session.generate_reply`
   instructing the agent to read the briefing, since the context arrived after the
   greeting.

Tradeoff: a cleaner caller hears the generic opener before their briefing — minor
double-open, acceptable for the demo. The client path (the primary demo) is
seamless because context is only needed after the caller states their request.

Bonus: parallelize the cleaner branch's `get_cleaner_briefing` and
`get_cleaner_preferences` fetches (`agent.py:347-352`) with `asyncio.gather` to
remove one sequential round-trip from the preload.

## Testing (TDD — required by AGENTS.md and the livekit-agents skill)

Write tests first in `client-call-agent/tests/`, iterate implementation to green:

1. **Translation payload.** create_booking payload carries `note_translated` in
   the resolved `cleaner_language`; raw `note` preserved for audit.
2. **No English leak.** A non-`en` cleaner language yields a briefing whose labels
   are localized (assert known English labels absent / localized labels present).
3. **Language resolution.** When `suggest_cleaner` returns a cleaner with
   `preferred_language`, that language flows into the create_booking payload;
   absent → back-filled from cleaner record → default `en`.
4. **Spoken cue.** `suggest_cleaner` and `create_booking` invoke `ctx.update`
   (assert called) and still return the tool result; filler still applied.
5. **Greet-first.** Greeting fires without awaiting preload; `update_instructions`
   is called once context resolves; cleaner role triggers a briefing read.
6. **Hook.** Extend dashboard/integration tests for localized create-booking
   labels and the per-language call-in template, including the `en` fallback.

## Files touched

- `client-call-agent/src/agent.py` — greet-first + parallel preload (D),
  `ctx.update` cues in tools (C), payload enrichment for `note_translated` (A).
- `client-call-agent/prompts/caller-agent-master-prompt.md` — §Language Behavior
  and §Five: instruct the agent to add `note_translated` per note in
  `cleaner_language` (A).
- `pocketbase/pb_hooks/cleanvoice.pb.js` — localized label map + `note_translated`
  rendering in create-booking (A); per-language call-in templates (B).
- `client-call-agent/tests/` — new behavior tests (all sections).
- `dashboard/tests/` — extend hook/integration coverage (A, B).

## Out of scope

- General per-turn STT-LLM-TTS latency (separate from this work).
- Enum value localization beyond labels (unless trivial via the same map).
- Cached/pre-synthesized TTS for the spoken cue (possible follow-up).
- After-call recommender line on the card (the existing stretch item).
