# Invisible PocketBase Preload Design

## Goal

Make caller identity and cleaner context available to the LiveKit agent before the caller hears the first response, while keeping cleaner preference lookup, cleaner suggestion, and booking creation available as LiveKit tools during the live conversation.

## Architecture

The caller app already dispatches the LiveKit agent with `caller_phone` metadata. The Python agent should read that metadata, call PocketBase directly before `ctx.connect()`, and inject the returned context into the agent instructions. This hides the lookup from the caller and prevents the LLM from spending its first conversational turn on `identify_caller`.

`get_cleaner_preferences`, `suggest_cleaner`, and `create_booking` remain `@function_tool` methods. `identify_caller` and `get_cleaner_briefing` stay hidden in preload so the LLM does not spend the first caller-facing turn on setup lookups.

## Data Flow

1. `web-caller` dispatches `client-call-agent` into `demo-call` with `caller_phone`.
2. `my_agent` extracts `caller_phone` from `ctx.job.metadata`.
3. `my_agent` calls `preload_call_context(caller_phone)` before `ctx.connect()`.
4. `preload_call_context` calls `PocketBaseClient.identify_caller`.
5. If the caller is the cleaner, `preload_call_context` also calls `PocketBaseClient.get_cleaner_briefing` and `PocketBaseClient.get_cleaner_preferences`.
6. `Assistant` receives the preloaded context in its prompt.
7. During the live call, the PocketBase function tools exposed to the LLM are `get_cleaner_preferences(caller_phone)`, `suggest_cleaner(booking_request)`, and `create_booking(payload)`.
8. For client booking intake, the agent calls `suggest_cleaner` before `create_booking`.
9. If `suggest_cleaner` returns an available cleaner phone, the agent includes `cleaner_phone` in the `create_booking` payload. Otherwise it omits `cleaner_phone`.

## Caller Experience

The caller should never hear tool names, raw lookup results, or a generic lookup pause for the initial identity check. If preload succeeds, the first useful spoken turn can be role-aware. If preload fails, the agent should continue with a conservative fallback: it may collect a tentative request, but it must not claim prior client facts, prices, services, area coverage, or final booking status.

## Error Handling

PocketBase preload failures should not crash the LiveKit job. The preload result should include a `lookup_status` of `unavailable` and a short internal error message for logs/prompt context. The spoken behavior remains conservative and caller-facing.

Booking write failures are different: `create_booking` is a live write action. If it fails, the tool should raise `ToolError`, and the agent should tell the caller that the request could not be saved and that the cleaner will need to confirm through a fallback path.

`suggest_cleaner` is a live decision-support lookup, not a final commitment. Its result can add `cleaner_phone` to the booking payload, but the spoken confirmation must remain tentative.

## Testing

Unit tests should verify that:

- `preload_call_context` calls `identify_caller`.
- cleaner preload also fetches `get_cleaner_briefing` and `get_cleaner_preferences`.
- preload failures return fallback context instead of raising.
- `Assistant().tools` exposes `get_cleaner_preferences`, `suggest_cleaner`, and `create_booking`, but not `identify_caller` or `get_cleaner_briefing`.
- `my_agent` performs preload before `session.start` and `ctx.connect`.
- the generated prompt contains the preloaded context and no longer tells the model to call `identify_caller` at the beginning.
