// Pure, dependency-free helpers for assembling cleaner-facing text in the
// cleaner's language. Required per-handler by cleanvoice.pb.js (PocketBase runs
// each route in an isolated VM) and unit-tested directly with Node.
//
// No PocketBase globals here. Keep this module pure so it stays testable.
//
// Translation note: en/de/tr/ru are authored with reasonable confidence; the
// pl/uk/ar strings are best-effort and should get a native-speaker review. Any
// unknown language or unmapped key falls back to the English value, and an
// un-normalized free-text service/type falls back to its raw value, so the
// output is always sensible even before review.

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
  ru: { service: "Услуга", location: "Адрес", requested: "Запрошено", until: "до" },
  pl: { service: "Usługa", location: "Lokalizacja", requested: "Termin", until: "do" },
  uk: { service: "Послуга", location: "Адреса", requested: "Запит", until: "до" },
  ar: { service: "الخدمة", location: "الموقع", requested: "الموعد المطلوب", until: "حتى" },
};

function labels(lang) {
  return LABELS[normLang(lang)] || LABELS.en;
}

// Canonical service_type enum -> localized display name. The agent is instructed
// to send one of these enum keys; unknown/free-text values fall back to the raw
// string so nothing is dropped.
const SERVICE_NAMES = {
  regular_cleaning: {
    en: "Regular cleaning",
    de: "Unterhaltsreinigung",
    tr: "Standart temizlik",
    ru: "Обычная уборка",
    pl: "Sprzątanie standardowe",
    uk: "Звичайне прибирання",
    ar: "تنظيف عادي",
  },
  deep_cleaning: {
    en: "Deep cleaning",
    de: "Grundreinigung",
    tr: "Derin temizlik",
    ru: "Генеральная уборка",
    pl: "Sprzątanie gruntowne",
    uk: "Генеральне прибирання",
    ar: "تنظيف عميق",
  },
  move_out: {
    en: "Move-out cleaning",
    de: "Umzugsreinigung",
    tr: "Taşınma temizliği",
    ru: "Уборка при переезде",
    pl: "Sprzątanie po przeprowadzce",
    uk: "Прибирання після переїзду",
    ar: "تنظيف عند الانتقال",
  },
  office: {
    en: "Office cleaning",
    de: "Büroreinigung",
    tr: "Ofis temizliği",
    ru: "Уборка офиса",
    pl: "Sprzątanie biura",
    uk: "Прибирання офісу",
    ar: "تنظيف المكاتب",
  },
  other: {
    en: "Other",
    de: "Sonstiges",
    tr: "Diğer",
    ru: "Другое",
    pl: "Inne",
    uk: "Інше",
    ar: "أخرى",
  },
};

function serviceName(serviceType, lang) {
  const key = (serviceType == null ? "" : String(serviceType)).trim();
  const names = SERVICE_NAMES[key];
  if (!names) return key || "cleaning";
  return names[normLang(lang)] || names.en;
}

// Canonical note/preference type -> localized prefix. Unknown types fall back to
// the raw type string.
const NOTE_TYPES = {
  access: { en: "access", de: "Zugang", tr: "erişim", ru: "доступ", pl: "dostęp", uk: "доступ", ar: "الوصول" },
  pets: { en: "pets", de: "Haustiere", tr: "evcil hayvan", ru: "питомцы", pl: "zwierzęta", uk: "тварини", ar: "حيوانات أليفة" },
  parking: { en: "parking", de: "Parken", tr: "otopark", ru: "парковка", pl: "parking", uk: "паркування", ar: "موقف السيارات" },
  property: { en: "property", de: "Objekt", tr: "mülk", ru: "объект", pl: "nieruchomość", uk: "об'єкт", ar: "العقار" },
  products: { en: "products", de: "Produkte", tr: "ürünler", ru: "средства", pl: "środki", uk: "засоби", ar: "المواد" },
  allergies: { en: "allergies", de: "Allergien", tr: "alerjiler", ru: "аллергии", pl: "alergie", uk: "алергії", ar: "الحساسية" },
  schedule: { en: "schedule", de: "Termin", tr: "zaman", ru: "график", pl: "termin", uk: "розклад", ar: "الموعد" },
  other: { en: "note", de: "Hinweis", tr: "not", ru: "примечание", pl: "uwaga", uk: "примітка", ar: "ملاحظة" },
};

function noteTypeLabel(type, lang) {
  const key = (type == null ? "" : String(type)).trim();
  if (!key) return "";
  const names = NOTE_TYPES[key];
  if (!names) return key;
  return names[normLang(lang)] || names.en;
}

function noteText(note) {
  if (!note) return "";
  return note.note_translated || note.note || "";
}

function buildBookingBriefing(args) {
  const a = args || {};
  const L = labels(a.lang);
  const lines = [L.service + ": " + serviceName(a.serviceType, a.lang)];
  const location = [a.street, a.postalCode, a.city].filter(Boolean).join(", ");
  if (location) lines.push(L.location + ": " + location);
  if (a.start) {
    lines.push(L.requested + ": " + a.start + (a.end ? " " + L.until + " " + a.end : ""));
  }
  (a.notes || []).forEach((n) => {
    const text = noteText(n);
    if (!text) return;
    const prefix = noteTypeLabel(n.type, a.lang);
    lines.push((prefix ? prefix + ": " : "") + text);
  });
  return lines.join("\n");
}

const SUMMARY_LEAD = {
  en: (name, svc) => name + " requested " + svc + ".",
  de: (name, svc) => name + " hat " + svc + " angefragt.",
  tr: (name, svc) => name + ", " + svc + " talep etti.",
  ru: (name, svc) => "Заявка от " + name + ": " + svc + ".",
  pl: (name, svc) => "Zgłoszenie od " + name + ": " + svc + ".",
  uk: (name, svc) => "Заявка від " + name + ": " + svc + ".",
  ar: (name, svc) => "طلب من " + name + ": " + svc + ".",
};

function buildCustomerSummary(args) {
  const a = args || {};
  const L = normLang(a.lang);
  const parts = [];
  if (a.clientName) {
    const lead = SUMMARY_LEAD[L] || SUMMARY_LEAD.en;
    parts.push(lead(a.clientName, serviceName(a.serviceType, a.lang)));
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
  ru: {
    head: (name, n) => "Здравствуйте, " + name + ". У вас " + n + " предстоящих заказов.",
    next: (svc, t) => " Следующий: " + svc + ", " + t + ".",
  },
  pl: {
    head: (name, n) => "Cześć " + name + ". Masz " + n + " nadchodzących rezerwacji.",
    next: (svc, t) => " Następna: " + svc + ", " + t + ".",
  },
  uk: {
    head: (name, n) => "Вітаю, " + name + ". У вас " + n + " майбутніх замовлень.",
    next: (svc, t) => " Наступне: " + svc + ", " + t + ".",
  },
  ar: {
    head: (name, n) => "مرحبًا " + name + ". لديك " + n + " حجز قادم.",
    next: (svc, t) => " التالي: " + svc + " في " + t + ".",
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
  return head + tpl.next(serviceName(a.nextServiceType, a.lang), a.nextStart || "");
}

module.exports = {
  SUPPORTED,
  DEFAULT_LANG,
  normLang,
  labels,
  serviceName,
  noteTypeLabel,
  buildBookingBriefing,
  buildCustomerSummary,
  buildCallInBriefing,
};
