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
  assert.match(out, /yaklaşan rezervasyonunuz var/);
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
