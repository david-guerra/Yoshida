# Invisible PocketBase Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preload caller context from PocketBase before the LiveKit agent connects, while exposing cleaner preferences, cleaner suggestion, and booking creation as LiveKit function tools.

**Architecture:** Add a small preload helper around the existing `PocketBaseClient`. Pass the helper result into `Assistant` so the prompt has role/context data at startup. Keep startup identity/briefing lookups hidden, and expose `get_cleaner_preferences`, `suggest_cleaner`, and `create_booking` for live conversation-time decisions.

**Tech Stack:** Python 3.13, LiveKit Agents Python, pytest, existing PocketBase HTTP endpoints.

## Global Constraints

- Agent backend remains Python.
- Use LiveKit docs-confirmed pattern: load user-specific external data before `ctx.connect()` when it is required at startup.
- Do not invent services, prices, areas, hours, availability, or booking confirmation.
- `get_cleaner_preferences`, `suggest_cleaner`, and `create_booking` remain LiveKit `@function_tool` methods.
- No production code before failing tests.

---

### Task 1: Preload Context Contract

**Files:**
- Modify: `client-call-agent/tests/test_agent.py`
- Modify: `client-call-agent/src/agent.py`

**Interfaces:**
- Produces: `async def preload_call_context(caller_phone: str, *, client: PocketBaseClient | None = None) -> dict[str, Any]`
- Consumes: existing `PocketBaseClient.identify_caller` and `PocketBaseClient.get_cleaner_briefing`

- [x] **Step 1: Write failing tests**

Add tests proving new/existing callers use `identify_caller`, cleaner callers also fetch briefing, and failures produce fallback context.

- [x] **Step 2: Run targeted tests**

Run: `uv run pytest tests/test_agent.py::test_preload_call_context_identifies_caller tests/test_agent.py::test_preload_call_context_fetches_cleaner_briefing tests/test_agent.py::test_preload_call_context_falls_back_when_pocketbase_fails -q`

Expected: fail because `preload_call_context` does not exist.

- [x] **Step 3: Implement helper**

Add `preload_call_context` to `client-call-agent/src/agent.py`.

- [x] **Step 4: Run targeted tests**

Run the same targeted tests and expect pass.

### Task 2: Prompt And Tool Boundary

**Files:**
- Modify: `client-call-agent/tests/test_agent.py`
- Modify: `client-call-agent/src/agent.py`
- Modify: `client-call-agent/prompts/caller-agent-master-prompt.md`

**Interfaces:**
- Consumes: `preload_call_context(...)`
- Produces: `Assistant(caller_phone: str | None = None, call_context: dict[str, Any] | None = None)`

- [x] **Step 1: Write failing tests**

Add tests proving only the hybrid live tools are exposed as PocketBase function tools and the prompt uses preloaded context instead of instructing the model to call `identify_caller` at startup.

- [x] **Step 2: Run targeted tests**

Run: `uv run pytest tests/test_agent.py::test_assistant_exposes_hybrid_pocketbase_tools tests/test_agent.py::test_prompt_uses_preloaded_context_without_startup_lookup_tool -q`

Expected: fail because old tools and startup lookup instructions remain.

- [x] **Step 3: Implement prompt/tool changes**

Remove `identify_caller` and `get_cleaner_briefing` methods from `Assistant`. Add `get_cleaner_preferences` and `suggest_cleaner` as live tools. Update prompt loading to include preloaded JSON context and remove startup tool-call instructions.

- [x] **Step 4: Run targeted tests**

Run the same targeted tests and expect pass.

### Task 3: Agent Entrypoint Wiring

**Files:**
- Modify: `client-call-agent/tests/test_agent.py`
- Modify: `client-call-agent/src/agent.py`

**Interfaces:**
- Consumes: `preload_call_context(...)`
- Produces: `my_agent` passes `call_context` into `Assistant`

- [x] **Step 1: Write failing test**

Add a source-level lifecycle test proving `preload_call_context(caller_phone)` happens before `session.start` and `ctx.connect()`.

- [x] **Step 2: Run targeted test**

Run: `uv run pytest tests/test_agent.py::test_agent_preloads_call_context_before_connecting -q`

Expected: fail because `my_agent` does not yet call the helper.

- [x] **Step 3: Wire preload into `my_agent`**

Call `preload_call_context(caller_phone)` before `AgentSession.start`, pass the result to `Assistant`.

- [x] **Step 4: Run full agent tests**

Run: `uv run pytest`.

Expected: all non-live tests pass, live eval tests remain skipped unless `RUN_LIVEKIT_EVALS=1`.
