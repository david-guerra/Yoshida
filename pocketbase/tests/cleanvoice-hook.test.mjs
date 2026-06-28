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
