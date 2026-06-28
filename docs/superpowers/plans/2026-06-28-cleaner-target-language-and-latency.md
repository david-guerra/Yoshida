# Cleaner Target-Language Output + Latency Masking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the cleaner-facing briefing, call summary, and order notes in the cleaner's own language, and keep the live agent from going silent during fetch/send — without adding call latency.

**Architecture:** A pure JS helper module assembles all localized cleaner-facing text deterministically (localized labels + structured values + agent-translated free text). The PocketBase hook requires it per-handler (isolated-VM constraint) and persists a `note_translated` column on notes/preferences. The dashboard prefers the translated text. The agent's prompt instructs it to supply `note_translated` inside the `create_booking` payload it already generates (zero extra round-trip). The agent voices a short cue via `ctx.update()` over the existing typing-sound filler, and greets first while the PocketBase preload runs in parallel, folding context in with `await agent.update_instructions(...)`.

**Tech Stack:** Python 3 + LiveKit Agents (`uv`, `pytest`), PocketBase v0.39.4 JSVM hooks/migrations (Goja), Next.js/TypeScript dashboard, Node.js built-in test runner (`node --test`).

## Global Constraints

- No hallucinated facts: the agent may only translate free text the caller provided; never invent or restate services/prices/areas/hours.
- Commitments come from data, not generation: structured fields (service_type, dates, address, phone) are never altered or translated.
- Zero added call latency: translation folds into the `create_booking` payload the LLM already generates; no new live-path LLM round-trip.
- Supported cleaner languages: `ar, de, en, pl, ru, tr, uk`; default and fallback `en`.
- LiveKit: `Agent.update_instructions(instructions: str)` is **async** — always `await` it. `ctx.update(...)` is async. Verify any other LiveKit API against the docs MCP before use.
- PocketBase hooks run each handler in an isolated VM — `require()` helpers **inside** each handler, never at module top.
- Tests follow the repo convention: behavior tests where runnable (pure helpers, async agent functions), source-inspection (`inspect.getsource` / `readFileSync`) for live-pipeline code.
- Run agent tests from `client-call-agent/` with `uv run pytest`; run JS tests from repo root with `node --test`.

---

### Task 1: Pure localization helper module

**Files:**
- Create: `pocketbase/pb_hooks/cleanvoice_briefing.js`
- Test: `pocketbase/tests/briefing.test.mjs`

**Interfaces:**
- Produces (CommonJS `module.exports`):
  - `normLang(lang: string) -> string` — lowercases/trims; returns the code if in `{ar,de,en,pl,ru,tr,uk}`, else `"en"`.
  - `labels(lang) -> {service, location, requested, until}` — localized label set.
  - `buildBookingBriefing({lang, serviceType, street, postalCode, city, start, end, notes}) -> string` — `notes` is an array of `{type?, note?, note_translated?}`; each line uses `note_translated ?? note`.
  - `buildCustomerSummary({lang, clientName, serviceType, notes}) -> string`.
  - `buildCallInBriefing({lang, name, upcomingCount, nextServiceType, nextStart}) -> string`.

- [ ] **Step 1: Write the failing test**

Create `pocketbase/tests/briefing.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import briefing from "../pb_hooks/cleanvoice_briefing.js";

test("normLang normalizes and falls back to en", () => {
  assert.equal(briefing.normLang("TR"), "tr");
  assert.equal(briefing.normLang(" de "), "de");
  assert.equal(briefing.normLang("klingon"), "en");
  assert.equal(briefing.normLang(""), "en");
  assert.equal(briefing.normLang(null), "en");
});

test("buildBookingBriefing localizes labels for the cleaner language", () => {
  const out = briefing.buildBookingBriefing({
    lang: "tr",
    serviceType: "deep_cleaning",
    city: "Berlin",
    start: "2026-06-30 10:00",
    notes: [],
  });
  assert.match(out, /Hizmet: deep_cleaning/);
  assert.match(out, /Konum: Berlin/);
  assert.doesNotMatch(out, /Service:/);
  assert.doesNotMatch(out, /Location:/);
});

test("buildBookingBriefing prefers note_translated and omits the raw note", () => {
  const out = briefing.buildBookingBriefing({
    lang: "en",
    serviceType: "regular_cleaning",
    notes: [
      { type: "access", note: "Hund im Haus", note_translated: "Dog in the home" },
    ],
  });
  assert.match(out, /access: Dog in the home/);
  assert.doesNotMatch(out, /Hund im Haus/);
});

test("buildBookingBriefing falls back to raw note when no translation", () => {
  const out = briefing.buildBookingBriefing({
    lang: "en",
    serviceType: "regular_cleaning",
    notes: [{ note: "Bitte klingeln" }],
  });
  assert.match(out, /Bitte klingeln/);
});

test("buildCustomerSummary localizes the lead and uses translated notes", () => {
  const out = briefing.buildCustomerSummary({
    lang: "de",
    clientName: "Anna",
    serviceType: "regular_cleaning",
    notes: [{ note: "ring", note_translated: "bitte klingeln" }],
  });
  assert.match(out, /Anna hat regular_cleaning angefragt\./);
  assert.match(out, /bitte klingeln/);
});

test("buildCallInBriefing uses the cleaner-language template", () => {
  const out = briefing.buildCallInBriefing({
    lang: "tr",
    name: "Ayse",
    upcomingCount: 2,
    nextServiceType: "deep_cleaning",
    nextStart: "2026-06-30 10:00",
  });
  assert.match(out, /Merhaba Ayse/);
  assert.match(out, /yaklaşan rezervasyon/);
  assert.doesNotMatch(out, /upcoming booking/);
});

test("buildBookingBriefing falls back to English labels for non-en/de/tr languages", () => {
  const out = briefing.buildBookingBriefing({
    lang: "ru",
    serviceType: "deep_cleaning",
    city: "Berlin",
    notes: [{ note: "x", note_translated: "переведено" }],
  });
  // ru has no localized label set -> English labels, but the agent-translated
  // note content still appears in the cleaner's language.
  assert.match(out, /Service: deep_cleaning/);
  assert.match(out, /Location: Berlin/);
  assert.match(out, /переведено/);
});

test("buildCallInBriefing falls back to en for unsupported language", () => {
  const out = briefing.buildCallInBriefing({
    lang: "klingon",
    name: "Sam",
    upcomingCount: 0,
  });
  assert.match(out, /Hi Sam\. You have 0 upcoming booking\(s\)\./);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test pocketbase/tests/briefing.test.mjs`
Expected: FAIL — `Cannot find module '../pb_hooks/cleanvoice_briefing.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `pocketbase/pb_hooks/cleanvoice_briefing.js`:

```js
// Pure, dependency-free helpers for assembling cleaner-facing text in the
// cleaner's language. Required per-handler by cleanvoice.pb.js (PocketBase runs
// each route in an isolated VM) and unit-tested directly with Node.
//
// No PocketBase globals here. Keep this module pure so it stays testable.

const SUPPORTED = ["ar", "de", "en", "pl", "ru", "tr", "uk"];
const DEFAULT_LANG = "en";

function normLang(lang) {
  const value = (lang == null ? "" : String(lang)).trim().toLowerCase();
  return SUPPORTED.indexOf(value) !== -1 ? value : DEFAULT_LANG;
}

const LABELS = {
  en: { service: "Service", location: "Location", requested: "Requested", until: "until" },
  de: { service: "Leistung", location: "Ort", requested: "Gewünscht", until: "bis" },
  tr: { service: "Hizmet", location: "Konum", requested: "İstenen", until: "-" },
};

// en/de/tr are localized; every other supported language falls back to the
// English label set. The agent still translates free-text notes into the
// cleaner's language via note_translated, so note content stays in-language
// even when labels fall back to English.
function labels(lang) {
  return LABELS[normLang(lang)] || LABELS.en;
}

function noteText(note) {
  if (!note) return "";
  return note.note_translated || note.note || "";
}

function buildBookingBriefing(args) {
  const a = args || {};
  const L = labels(a.lang);
  const lines = [L.service + ": " + (a.serviceType || "cleaning")];
  const location = [a.street, a.postalCode, a.city].filter(Boolean).join(", ");
  if (location) lines.push(L.location + ": " + location);
  if (a.start) {
    lines.push(L.requested + ": " + a.start + (a.end ? " " + L.until + " " + a.end : ""));
  }
  (a.notes || []).forEach((n) => {
    const text = noteText(n);
    if (text) lines.push((n.type ? n.type + ": " : "") + text);
  });
  return lines.join("\n");
}

const SUMMARY_LEAD = {
  en: (name, svc) => name + " requested " + svc + ".",
  de: (name, svc) => name + " hat " + svc + " angefragt.",
  tr: (name, svc) => name + ", " + svc + " talep etti.",
};

function buildCustomerSummary(args) {
  const a = args || {};
  const L = normLang(a.lang);
  const parts = [];
  if (a.clientName) {
    const lead = SUMMARY_LEAD[L] || SUMMARY_LEAD.en;
    parts.push(lead(a.clientName, a.serviceType || "a cleaning"));
  }
  (a.notes || []).forEach((n) => {
    const text = noteText(n);
    if (text) parts.push(text);
  });
  return parts.join(" ");
}

const CALL_IN = {
  en: {
    head: (name, n) => "Hi " + name + ". You have " + n + " upcoming booking(s).",
    next: (svc, t) => " Next: " + svc + " at " + t + ".",
  },
  de: {
    head: (name, n) => "Hallo " + name + ". Du hast " + n + " anstehende Buchung(en).",
    next: (svc, t) => " Nächster Termin: " + svc + " am " + t + ".",
  },
  tr: {
    head: (name, n) => "Merhaba " + name + ". " + n + " yaklaşan rezervasyonunuz var.",
    next: (svc, t) => " Sıradaki: " + svc + ", " + t + ".",
  },
};

function buildCallInBriefing(args) {
  const a = args || {};
  const tpl = CALL_IN[normLang(a.lang)] || CALL_IN.en;
  const name = (a.name == null ? "" : String(a.name)).trim();
  const count = a.upcomingCount || 0;
  const head = tpl.head(name, count);
  const hasNext = Boolean(a.nextServiceType || a.nextStart);
  if (!hasNext) return head;
  return head + tpl.next(a.nextServiceType || "cleaning", a.nextStart || "");
}

module.exports = {
  SUPPORTED,
  DEFAULT_LANG,
  normLang,
  labels,
  buildBookingBriefing,
  buildCustomerSummary,
  buildCallInBriefing,
};
```

> Note: en/de/tr are localized in proper Unicode (the file is UTF-8; Goja and Node both handle Unicode). Every other supported cleaner language falls back to the English label/template set, while the agent-supplied `note_translated` still carries note content in the cleaner's language. `en` is always the fallback. Do not add ASCII transliterations.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test pocketbase/tests/briefing.test.mjs`
Expected: PASS — 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add pocketbase/pb_hooks/cleanvoice_briefing.js pocketbase/tests/briefing.test.mjs
git commit -m "Add pure cleaner-language briefing helper module"
```

---

### Task 2: Migration — add `note_translated` to notes + preferences

**Files:**
- Create: `pocketbase/pb_migrations/1782604800_add_note_translated.js`

**Interfaces:**
- Produces: a `note_translated` text column (max 2000, optional) on collections `pbc_2035508808` (booking_notes) and `pbc_2186768164` (client_preferences).

- [ ] **Step 1: Write the migration**

Create `pocketbase/pb_migrations/1782604800_add_note_translated.js`:

```js
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const ids = ["pbc_2035508808", "pbc_2186768164"]; // booking_notes, client_preferences
  const fieldIds = {
    pbc_2035508808: "text9900000011",
    pbc_2186768164: "text9900000012",
  };
  ids.forEach((id) => {
    const collection = app.findCollectionByNameOrId(id);
    collection.fields.add(
      new Field({
        autogeneratePattern: "",
        hidden: false,
        id: fieldIds[id],
        max: 2000,
        min: 0,
        name: "note_translated",
        pattern: "",
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: "text",
      }),
    );
    app.save(collection);
  });
}, (app) => {
  const ids = ["pbc_2035508808", "pbc_2186768164"];
  ids.forEach((id) => {
    const collection = app.findCollectionByNameOrId(id);
    const field = collection.fields.getByName("note_translated");
    if (field) {
      collection.fields.removeById(field.id);
      app.save(collection);
    }
  });
});
```

- [ ] **Step 2: Apply and verify the migration**

Run:
```bash
cd /Users/davidguerra/Telli/CleanVoice/pocketbase
./pocketbase migrate up 2>&1 | tail -5
./pocketbase migrate collections 2>/dev/null | grep -i note_translated || true
```
Expected: migrate reports the new migration applied with no error. (If the binary cannot run in this environment, this verification is performed at integration time; the migration file is still committed.)

- [ ] **Step 3: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add pocketbase/pb_migrations/1782604800_add_note_translated.js
git commit -m "Add note_translated column to booking_notes and client_preferences"
```

---

### Task 3: Wire the helper into the PocketBase hook

**Files:**
- Modify: `pocketbase/pb_hooks/cleanvoice.pb.js` (cleaner-briefing handler ~106-119; create-booking handler ~304-353)
- Test: `pocketbase/tests/cleanvoice-hook.test.mjs`

**Interfaces:**
- Consumes: `cleanvoice_briefing.js` (Task 1) via `require(`${__hooks}/cleanvoice_briefing.js`)`.
- Consumes: `note_translated` column (Task 2).

- [ ] **Step 1: Write the failing test**

Create `pocketbase/tests/cleanvoice-hook.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const hookSource = readFileSync(
  new URL("../pb_hooks/cleanvoice.pb.js", import.meta.url),
  "utf8",
);

test("hook requires the localization helper inside handlers", () => {
  const requires = hookSource.match(/require\(`\$\{__hooks\}\/cleanvoice_briefing\.js`\)/g) || [];
  // Once in the cleaner-briefing handler, once in the create-booking handler.
  assert.ok(requires.length >= 2, `expected >= 2 requires, got ${requires.length}`);
});

test("hook builds localized call-in and booking text via the helper", () => {
  assert.match(hookSource, /buildCallInBriefing\(/);
  assert.match(hookSource, /buildBookingBriefing\(/);
  assert.match(hookSource, /buildCustomerSummary\(/);
});

test("hook persists note_translated on notes and preferences", () => {
  assert.match(hookSource, /set\("note_translated"/);
});

test("hook no longer hardcodes English briefing labels", () => {
  assert.doesNotMatch(hookSource, /"Service: " \+/);
  assert.doesNotMatch(hookSource, /"Location: " \+/);
  assert.doesNotMatch(hookSource, /upcoming booking\(s\)\."/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test pocketbase/tests/cleanvoice-hook.test.mjs`
Expected: FAIL — current hook hardcodes labels and does not require the helper.

- [ ] **Step 3: Implement — cleaner-briefing handler**

In `pocketbase/pb_hooks/cleanvoice.pb.js`, replace the cleaner-briefing assembly (currently lines ~106-119, the `const parts = [...]` block through its `return e.json(200, {...})`):

```js
  const cleanvoiceBriefing = require(`${__hooks}/cleanvoice_briefing.js`);
  const lang = cleaner.get("preferred_language") || "en";
  const next = future.length ? future[0] : null;
  const briefingText = cleanvoiceBriefing.buildCallInBriefing({
    lang: lang,
    name: cleaner.get("name") || "",
    upcomingCount: future.length,
    nextServiceType: next ? next.get("service_type") : "",
    nextStart: next ? next.get("start_time") : "",
  });

  return e.json(200, {
    briefing: briefingText,
    preferred_language: lang,
    cleaner_name: cleaner.get("name"),
  });
```

- [ ] **Step 4: Implement — create-booking briefing + summary**

Replace the briefing/summary assembly in the create-booking handler (currently lines ~304-325, the `const lang = ...` through the `summary` loop and `cleanerBriefing` join):

```js
  const cleanvoiceBriefing = require(`${__hooks}/cleanvoice_briefing.js`);
  const lang = p.cleaner_language || cleaner.get("preferred_language") || "en";

  const cleanerBriefing = cleanvoiceBriefing.buildBookingBriefing({
    lang: lang,
    serviceType: bk.service_type || "cleaning",
    street: addr.street || "",
    postalCode: addr.postal_code || "",
    city: addr.city || "",
    start: start,
    end: end,
    notes: notesArr,
  });

  const customerSummary = cleanvoiceBriefing.buildCustomerSummary({
    lang: lang,
    clientName: clientData.name || "",
    serviceType: bk.service_type || "a cleaning",
    notes: notesArr,
  });
```

Then update the booking write to use `customerSummary` (the line currently reading `booking.set("customer_summary", summary.join(" "));`):

```js
  booking.set("customer_summary", customerSummary);
  booking.set("cleaner_briefing", cleanerBriefing);
```

- [ ] **Step 5: Implement — persist note_translated**

In the booking-notes write loop (currently `rec.set("note", n.note || "")`), add the translated value:

```js
    rec.set("note", n.note || "");
    rec.set("note_translated", n.note_translated || "");
```

In the client-preferences write loop (currently `rec.set("note", pr.note || "")`), add:

```js
    rec.set("note", pr.note || "");
    rec.set("note_translated", pr.note_translated || "");
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test pocketbase/tests/cleanvoice-hook.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add pocketbase/pb_hooks/cleanvoice.pb.js pocketbase/tests/cleanvoice-hook.test.mjs
git commit -m "Localize cleaner briefing, summary, and notes in PocketBase hook"
```

---

### Task 4: Dashboard prefers translated note text

**Files:**
- Modify: `dashboard/src/lib/orders.ts` (types `PocketBaseNote` ~40-46, `PocketBasePreference` ~48-54; mappers ~93-101 and ~119-127)
- Test: `dashboard/tests/cleaner-target-language.test.mjs`

**Interfaces:**
- Consumes: `note_translated` field returned by PocketBase records.

- [ ] **Step 1: Write the failing test**

Create `dashboard/tests/cleaner-target-language.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ordersSource = readFileSync(
  new URL("../src/lib/orders.ts", import.meta.url),
  "utf8",
);

test("PocketBase note/preference types include note_translated", () => {
  const matches = ordersSource.match(/note_translated\?: string;/g) || [];
  assert.ok(matches.length >= 2, `expected >= 2 type fields, got ${matches.length}`);
});

test("note mappers prefer the translated text over the raw note", () => {
  const matches = ordersSource.match(/item\.note_translated \|\| item\.note/g) || [];
  assert.ok(matches.length >= 2, `expected >= 2 mappers, got ${matches.length}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test dashboard/tests/cleaner-target-language.test.mjs`
Expected: FAIL — `note_translated` not present in `orders.ts`.

- [ ] **Step 3: Implement — types**

In `dashboard/src/lib/orders.ts`, add `note_translated?: string;` to both `PocketBaseNote` and `PocketBasePreference`:

```ts
type PocketBaseNote = {
  id: string;
  type?: string;
  note?: string;
  note_translated?: string;
  importance?: string;
  read_to_cleaner?: boolean;
};

type PocketBasePreference = {
  id: string;
  type?: string;
  note?: string;
  note_translated?: string;
  importance?: string;
  is_persistent?: boolean;
};
```

- [ ] **Step 4: Implement — mappers**

In `getBookingNotes`, change the note mapping line `note: item.note ?? "",` to:

```ts
      note: item.note_translated || item.note || "",
```

In `getClientPreferences`, change the note mapping line `note: item.note ?? "",` to:

```ts
      note: item.note_translated || item.note || "",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/davidguerra/Telli/CleanVoice && node --test dashboard/tests/cleaner-target-language.test.mjs`
Expected: PASS — 2 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add dashboard/src/lib/orders.ts dashboard/tests/cleaner-target-language.test.mjs
git commit -m "Dashboard renders translated note text on the cleaner order card"
```

---

### Task 5: Prompt — instruct the agent to supply translations

**Files:**
- Modify: `client-call-agent/prompts/caller-agent-master-prompt.md` (§Language Behavior ~28-32; §Five payload example ~291-333)
- Test: `client-call-agent/tests/test_agent.py`

**Interfaces:**
- Produces: prompt text containing the `note_translated` instruction, asserted by the agent prompt test.

- [ ] **Step 1: Write the failing test**

Add to `client-call-agent/tests/test_agent.py`:

```python
def test_prompt_requires_translated_notes_for_cleaner_card() -> None:
    instructions = Assistant().instructions

    assert "note_translated" in instructions
    assert (
        "translate each free-text note into the cleaner's language" in instructions
    )
    assert "Keep the original `note` verbatim" in instructions
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_prompt_requires_translated_notes_for_cleaner_card -v`
Expected: FAIL — `note_translated` not in the prompt.

- [ ] **Step 3: Implement — Language Behavior note**

In `client-call-agent/prompts/caller-agent-master-prompt.md`, after the paragraph that ends with `cleaner.preferred_language` when creating the booking.` (end of §Language Behavior, ~line 32), add:

```markdown

For the cleaner-facing card, translate each free-text note into the cleaner's
language (`cleaner_language`) and send it as `note_translated` alongside the
original. Keep the original `note` verbatim for the cleaner's audit trail. This
applies to every item in `booking_notes` and `client_preferences`. Never
translate or alter structured fields (service_type, dates, address, phone,
price) — only free text.
```

- [ ] **Step 4: Implement — payload example**

In §Five, update the `booking_notes` and `client_preferences` objects in the payload example to include `note_translated`:

```json
  "booking_notes": [
    {
      "type": "",
      "note": "",
      "note_translated": "",
      "importance": "normal",
      "read_to_cleaner": true
    }
  ],
  "client_preferences": [
    {
      "type": "",
      "note": "",
      "note_translated": "",
      "is_persistent": true,
      "importance": "normal"
    }
  ]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_prompt_requires_translated_notes_for_cleaner_card -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add client-call-agent/prompts/caller-agent-master-prompt.md client-call-agent/tests/test_agent.py
git commit -m "Instruct agent to supply note_translated for the cleaner card"
```

---

### Task 6: Spoken cue during tool calls

**Files:**
- Modify: `client-call-agent/src/agent.py` (`suggest_cleaner` ~421-435; `create_booking` ~461-476)
- Test: `client-call-agent/tests/test_agent.py`

**Interfaces:**
- Consumes: `RunContext.update(message)` (async; verified via LiveKit docs MCP).

- [ ] **Step 1: Write the failing test**

Add to `client-call-agent/tests/test_agent.py`:

```python
def test_pocketbase_tools_voice_a_spoken_cue() -> None:
    suggest_source = inspect.getsource(Assistant.suggest_cleaner)
    create_source = inspect.getsource(Assistant.create_booking)

    assert "await context.update(" in suggest_source
    assert "await context.update(" in create_source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_pocketbase_tools_voice_a_spoken_cue -v`
Expected: FAIL — `context.update` not present.

- [ ] **Step 3: Implement**

In `suggest_cleaner`, add the cue immediately before the `async with context.with_filler(` block:

```python
        await context.update(
            "Ich pruefe kurz, welche Reinigungskraft zu dieser Anfrage passt."
        )
        async with context.with_filler(
            keyboard_filler_source(context),
            delay=KEYBOARD_FILLER_DELAY_SECONDS,
            interval=KEYBOARD_FILLER_INTERVAL_SECONDS,
            max_steps=KEYBOARD_FILLER_MAX_STEPS,
        ):
            return await PocketBaseClient().suggest_cleaner(booking_request)
```

In `create_booking`, add the cue immediately before the `async with context.with_filler(` block (keep the existing `context.disallow_interruptions()` call above it):

```python
        await context.update("Ich speichere die Anfrage kurz fuer die Reinigungskraft.")
        async with context.with_filler(
            keyboard_filler_source(context),
            delay=KEYBOARD_FILLER_DELAY_SECONDS,
            interval=KEYBOARD_FILLER_INTERVAL_SECONDS,
            max_steps=KEYBOARD_FILLER_MAX_STEPS,
        ):
            return await PocketBaseClient().create_booking(payload)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_pocketbase_tools_voice_a_spoken_cue tests/test_agent.py::test_pocketbase_tools_use_keyboard_filler -v`
Expected: PASS — both the new cue test and the existing filler test pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add client-call-agent/src/agent.py client-call-agent/tests/test_agent.py
git commit -m "Voice a short cue while suggest_cleaner and create_booking run"
```

---

### Task 7: Parallelize the cleaner-branch preload

**Files:**
- Modify: `client-call-agent/src/agent.py` (add `import asyncio`; `preload_call_context` cleaner branch ~346-352)
- Test: `client-call-agent/tests/test_agent.py` (update `test_preload_call_context_fetches_cleaner_briefing` ~234-293)

**Interfaces:**
- Produces: `preload_call_context` issues the cleaner briefing and preferences fetches concurrently; the returned dict shape is unchanged.

- [ ] **Step 1: Update the existing test to not require strict call ordering**

In `client-call-agent/tests/test_agent.py`, replace the final assertion of `test_preload_call_context_fetches_cleaner_briefing` (currently the `assert calls == [...]` block at the end of that test) with:

```python
    assert calls[0] == ("identify_caller", "+491700000001")
    assert set(calls[1:]) == {
        ("get_cleaner_briefing", "+491700000001"),
        ("get_cleaner_preferences", "+491700000001"),
    }
```

(The dict-equality assertion on `result` earlier in the test stays unchanged.)

- [ ] **Step 2: Run test to verify it still passes against current sequential code**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_preload_call_context_fetches_cleaner_briefing -v`
Expected: PASS (the relaxed assertion holds for the current sequential implementation too).

- [ ] **Step 3: Implement the concurrent fetch**

Add `import asyncio` to the imports at the top of `client-call-agent/src/agent.py` (alphabetically, before `import json`).

In `preload_call_context`, replace the cleaner branch (currently):

```python
        if role == "cleaner":
            context["cleaner_briefing"] = await pocketbase.get_cleaner_briefing(
                caller_phone
            )
            context["cleaner_preferences"] = await pocketbase.get_cleaner_preferences(
                caller_phone
            )
        return context
```

with:

```python
        if role == "cleaner":
            briefing, preferences = await asyncio.gather(
                pocketbase.get_cleaner_briefing(caller_phone),
                pocketbase.get_cleaner_preferences(caller_phone),
            )
            context["cleaner_briefing"] = briefing
            context["cleaner_preferences"] = preferences
        return context
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_preload_call_context_fetches_cleaner_briefing tests/test_agent.py::test_preload_call_context_identifies_caller tests/test_agent.py::test_preload_call_context_falls_back_when_pocketbase_fails -v`
Expected: PASS — all three preload tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add client-call-agent/src/agent.py client-call-agent/tests/test_agent.py
git commit -m "Fetch cleaner briefing and preferences concurrently during preload"
```

---

### Task 8: Greet first, load context in parallel

**Files:**
- Modify: `client-call-agent/src/agent.py` (`my_agent` ~483-546)
- Test: `client-call-agent/tests/test_agent.py` (update `test_agent_preloads_call_context_before_starting_session` ~84-92 and `test_agent_reads_caller_phone_from_livekit_job_metadata` ~74-81; add a new test)

**Interfaces:**
- Consumes: `Assistant`, `preload_call_context`, `load_caller_agent_prompt`, `asyncio` (Task 7).
- Consumes: `await assistant.update_instructions(...)` (async — Task constraints).

- [ ] **Step 1: Update/replace the existing structural tests**

In `client-call-agent/tests/test_agent.py`, replace the body of `test_agent_preloads_call_context_before_starting_session` with:

```python
def test_agent_preloads_call_context_before_starting_session() -> None:
    session_source = inspect.getsource(agent_module.my_agent)

    preload_index = session_source.index(
        "preload_task = asyncio.create_task(preload_call_context(caller_phone))"
    )
    start_index = session_source.index("await session.start(")

    # Preload is kicked off (but not awaited) before the session starts, so it
    # overlaps model warmup instead of delaying the greeting.
    assert preload_index < start_index
    assert "call_context = await preload_task" in session_source
```

Replace the second assertion of `test_agent_reads_caller_phone_from_livekit_job_metadata` (the `Assistant(caller_phone=caller_phone, call_context=call_context)` assertion) with:

```python
    assert (
        "Assistant(caller_phone=caller_phone, call_context=loading_context)"
        in session_source
    )
```

Add a new test:

```python
def test_agent_folds_context_in_after_greeting() -> None:
    session_source = inspect.getsource(agent_module.my_agent)

    greeting_index = session_source.index("await session.generate_reply(")
    update_index = session_source.index("await assistant.update_instructions(")
    preload_await_index = session_source.index("call_context = await preload_task")

    # Greeting fires first; context is awaited and folded in afterwards.
    assert greeting_index < preload_await_index
    assert preload_await_index < update_index
    # A cleaner caller's briefing is read once context has landed.
    assert 'call_context.get("role") == "cleaner"' in session_source
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py::test_agent_preloads_call_context_before_starting_session tests/test_agent.py::test_agent_folds_context_in_after_greeting -v`
Expected: FAIL — current `my_agent` awaits preload before start and builds `Assistant(..., call_context=call_context)`.

- [ ] **Step 3: Implement the greet-first entrypoint**

In `client-call-agent/src/agent.py`, replace the body of `my_agent` (from `caller_phone = caller_phone_from_job_metadata(ctx.job.metadata)` through the final `await session.generate_reply(...)` greeting block) with:

```python
    caller_phone = caller_phone_from_job_metadata(ctx.job.metadata)

    # Kick off the PocketBase preload concurrently so it overlaps model warmup
    # and the greeting instead of delaying the first spoken word.
    preload_task = asyncio.create_task(preload_call_context(caller_phone))

    tts_options = {"model": "elevenlabs/eleven_flash_v2_5", "language": "de"}
    if elevenlabs_voice_id := os.getenv("ELEVENLABS_VOICE_ID"):
        tts_options["voice"] = elevenlabs_voice_id

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        tts=inference.TTS(**tts_options),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
        preemptive_generation=True,
    )

    loading_context = {
        "lookup_status": "loading",
        "caller_phone": caller_phone,
        "role": "unknown",
    }
    assistant = Assistant(caller_phone=caller_phone, call_context=loading_context)

    await session.start(
        agent=assistant,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )

    # Greet the caller in German immediately, without waiting on PocketBase.
    await session.generate_reply(
        instructions=(
            "Greet the caller in German. Say that this is the Reinigung front desk, "
            "ask how you can help with the cleaning request, and keep it to one short sentence."
        )
    )

    # Context loaded during warmup + greeting. Fold it into the live agent.
    call_context = await preload_task
    await assistant.update_instructions(
        load_caller_agent_prompt(caller_phone=caller_phone, call_context=call_context)
    )

    # A cleaner who calls in expects their briefing read. Context arrived after
    # the greeting, so prompt the agent to read it now.
    if call_context.get("role") == "cleaner":
        await session.generate_reply(
            instructions=(
                "Read the cleaner briefing from the preloaded context verbatim, "
                "in a natural spoken voice."
            )
        )
```

(Delete the now-removed standalone `call_context = await preload_call_context(caller_phone)` line and the old `Assistant(caller_phone=caller_phone, call_context=call_context)` passed inline to `session.start`.)

- [ ] **Step 4: Run the full agent test suite**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest tests/test_agent.py -v`
Expected: PASS — including the updated structural tests and the unchanged `test_agent_greets_caller_after_joining_room` / `test_agent_session_start_owns_room_connection`. (Live evals remain skipped without `RUN_LIVEKIT_EVALS=1`.)

- [ ] **Step 5: Lint and format**

Run: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run ruff format && uv run ruff check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/davidguerra/Telli/CleanVoice
git add client-call-agent/src/agent.py client-call-agent/tests/test_agent.py
git commit -m "Greet first and fold PocketBase context in via update_instructions"
```

---

## Final verification

- [ ] Run all JS tests: `cd /Users/davidguerra/Telli/CleanVoice && node --test pocketbase/tests/ dashboard/tests/`
- [ ] Run all agent tests: `cd /Users/davidguerra/Telli/CleanVoice/client-call-agent && uv run pytest -v`
- [ ] (Integration, if a PocketBase binary + LiveKit creds are available) Start PocketBase with the migration applied, place a demo call with a non-`en` cleaner language, and confirm the order card (briefing, call summary, notes) renders in the cleaner's language and the agent voices a cue during `create_booking`.
- [ ] Submit LiveKit docs feedback if any gaps were found while building (per AGENTS.md).

## Spec coverage check

- Spec §A (booking-card translation, hybrid) → Tasks 1, 3, 5 (+ 2, 4 for the notes list the spec's mental model missed).
- Spec §B (cleaner call-in briefing) → Tasks 1, 3.
- Spec §C (spoken cue + filler) → Task 6.
- Spec §D (greet-first + parallel preload) → Tasks 7, 8.
- Full-card scope decision (persist `note_translated`, localize call summary + preferences) → Tasks 2, 3, 4.
- TDD throughout; frequent commits; `en` fallback everywhere; structured fields never translated.
