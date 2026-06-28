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
