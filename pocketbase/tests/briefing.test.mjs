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
  assert.match(out, /Hizmet: Derin temizlik/);
  assert.match(out, /Konum: Berlin/);
  assert.doesNotMatch(out, /Service:/);
  assert.doesNotMatch(out, /Location:/);
  assert.doesNotMatch(out, /deep_cleaning/);
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
  assert.match(out, /Anna hat Unterhaltsreinigung angefragt\./);
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

test("buildBookingBriefing fully localizes for ru (labels, service, note type)", () => {
  const out = briefing.buildBookingBriefing({
    lang: "ru",
    serviceType: "deep_cleaning",
    city: "Berlin",
    notes: [
      { type: "pets", note: "Tiene un gato", note_translated: "В квартире есть кот." },
    ],
  });
  assert.match(out, /Услуга: Генеральная уборка/);
  assert.match(out, /Адрес: Berlin/);
  assert.match(out, /питомцы: В квартире есть кот\./);
  assert.doesNotMatch(out, /Service:/);
  assert.doesNotMatch(out, /Location:/);
  assert.doesNotMatch(out, /deep_cleaning/);
});

test("service/type fall back to the raw value when not a known enum/type", () => {
  const out = briefing.buildBookingBriefing({
    lang: "en",
    serviceType: "limpieza sencilla",
    notes: [{ type: "mascotas", note: "x", note_translated: "Dog" }],
  });
  // Un-normalized free text is shown verbatim (no crash, no drop) — but the
  // prompt instructs the agent to send canonical enum/type values instead.
  assert.match(out, /Service: limpieza sencilla/);
  assert.match(out, /mascotas: Dog/);
});

test("buildCallInBriefing falls back to en for unsupported language", () => {
  const out = briefing.buildCallInBriefing({
    lang: "klingon",
    name: "Sam",
    upcomingCount: 0,
  });
  assert.match(out, /Hi Sam\. You have 0 upcoming booking\(s\)\./);
});
