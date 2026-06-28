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
