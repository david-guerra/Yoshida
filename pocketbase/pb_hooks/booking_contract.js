// Shared transactional mutation boundary. Imported inside each isolated route VM.
function fail(status, message) { throw new ApiError(status, message); }
function required(value, name) {
  if (typeof value !== "string" || !value.trim()) fail(400, name + " is required.");
  return value.trim();
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function rows(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, "", 1, 0, params);
}
function configuredCleaner(app) {
  const id = $os.getenv("CLEANVOICE_CLEANER_ID");
  const found = id ? rows(app, "cleaners", "id = {:id} && active = true", {id}) : [];
  if (!found.length) fail(400, "The configured active cleaner is unavailable. No request was saved.");
  return found[0];
}
function isOwner(auth, cleaner) {
  return auth && auth.collection().name === "users" && cleaner.getString("user") === auth.id;
}
function authorize(auth, token, submission, app) {
  const cleaner = app.findRecordById("cleaners", submission.getString("cleaner"));
  if (auth) {
    if (isOwner(auth, cleaner)) return;
  } else if (token && submission.getString("recovery_hash") === $security.sha256(token)) return;
  fail(404, "Submission not found.");
}
function berlinStart(value) {
  const raw = required(value, "start_time");
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.exec(raw);
  if (!match) fail(400, "Use a complete Berlin date and time, with an explicit offset if ambiguous.");
  const local = match[1] + "T" + match[2] + (match[3] || ":00");
  const zone = new Timezone("Europe/Berlin");
  const localAt = (iso) => new DateTime(iso).time().in(zone).format("2006-01-02T15:04:05");
  let iso;
  if (match[4]) {
    try { iso = new Date(local + match[4]).toISOString(); } catch (_) { fail(400, "Invalid appointment date."); }
    // An explicit offset is an instant; ensure its calendar date isn't normalized
    // (e.g. February 30). Offset strings describe Berlin wall time; Z is UTC.
    const parsedLocal = new Date(local + "Z");
    if (isNaN(parsedLocal.getTime()) || parsedLocal.toISOString().slice(0,19) !== local) fail(400, "Invalid appointment date.");
    if (match[4] !== "Z" && localAt(iso) !== local) fail(400, "Offset does not match this Berlin appointment.");
  } else {
    const candidates = ["+01:00", "+02:00"].map(offset => {
      try { return new Date(local + offset).toISOString(); } catch (_) { return ""; }
    }).filter(candidate => candidate && localAt(candidate) === local);
    if (candidates.length !== 1) fail(400, "Berlin time is nonexistent or ambiguous; clarify the date or UTC offset.");
    iso = candidates[0];
  }
  return iso;
}
function validate(p) {
  if (p.reviewed !== true) fail(400, "Review and approve the request details before saving.");
  required(p.caller_phone, "caller_phone");
  const client = p.client || {}, address = p.address || {}, booking = p.booking || {};
  required(client.name, "client.name");
  ["street", "postal_code", "city", "country"].forEach(k => required(address[k], "address." + k));
  required(booking.service_type, "service_type");
  if (booking.timezone !== "Europe/Berlin") fail(400, "Appointment timezone must be Europe/Berlin.");
  const hours = booking.estimated_hours;
  if (typeof hours !== "number" || !isFinite(hours) || hours <= 0) fail(400, "Duration must be a positive number.");
  const start = berlinStart(booking.start_time);
  if (Date.parse(start) <= Date.now()) fail(400, "Appointment must be in the future.");
  const end = new Date(Date.parse(start) + hours * 3600000);
  if (isNaN(end.getTime())) fail(400, "Invalid appointment duration.");
  if (booking.end_time && Date.parse(berlinStart(booking.end_time)) !== end.getTime()) fail(400, "End time must agree with duration.");
  if (booking.budget != null && (typeof booking.budget !== "number" || !isFinite(booking.budget) || booking.budget < 0)) fail(400, "Budget must be a nonnegative number or unknown.");
  ["booking_notes", "client_preferences"].forEach(k => {
    if (p[k] != null && (!Array.isArray(p[k]) || p[k].some(n => !n || typeof n !== "object" || Array.isArray(n)))) fail(400, k + " must be an array of notes.");
  });
  return {start, end: end.toISOString(), hours};
}
function record(app, name, values) {
  const r = new Record(app.findCollectionByNameOrId(name));
  Object.keys(values).forEach(k => r.set(k, values[k]));
  app.save(r);
  return r;
}
function create(app, p, auth, token) {
  const id = required(p.submission_id, "submission_id");
  if (!/^[a-zA-Z0-9_-]{20,100}$/.test(id)) fail(400, "Invalid submission identity.");
  if (!auth && !/^[a-zA-Z0-9_-]{32,128}$/.test(token || "")) fail(401, "A private submission recovery token is required.");
  const hash = $security.sha256(canonical(p));
  let receipt;
  app.runInTransaction(tx => {
    // PocketBase serializes transactions on its single writer connection. The
    // UNIQUE index is the final guard across every writer and survives restart.
    const existing = rows(tx, "booking_submissions", "submission_id = {:id}", {id});
    if (existing.length) {
      authorize(auth, token, existing[0], tx);
      if (existing[0].getString("payload_hash") !== hash) fail(409, "Submission identity already belongs to different reviewed details.");
      receipt = existing[0].get("receipt");
      return;
    }
    const dates = validate(p);
    const cleaner = configuredCleaner(tx);
    if (auth && !isOwner(auth, cleaner)) fail(403, "Only the configured cleaner can create a manual request.");
    const clientData = p.client, addr = p.address, bk = p.booking;
    const found = rows(tx, "clients", "phone = {:phone}", {phone:p.caller_phone});
    const client = found.length ? found[0] : new Record(tx.findCollectionByNameOrId("clients"));
    client.set("phone", p.caller_phone);
    client.set("name", clientData.name);
    ["email", "notes", "preferred_language"].forEach(k => { if (clientData[k] != null) client.set(k, clientData[k]); });
    if (!found.length) client.set("status", "new");
    tx.save(client);
    const address = record(tx, "addresses", {client:client.id, label:addr.label || "Booking address", is_default:!found.length,
      street:addr.street, postal_code:addr.postal_code, city:addr.city, country:addr.country, access_notes:addr.access_notes || ""});
    const notes = p.booking_notes || [], lang = cleaner.getString("preferred_language") || "en";
    const briefing = require(`${__hooks}/cleanvoice_briefing.js`);
    const cleanerBriefing = bk.cleaner_briefing || briefing.buildBookingBriefing({lang, serviceType:bk.service_type,
      street:addr.street, postalCode:addr.postal_code, city:addr.city, start:dates.start, end:dates.end, notes});
    const summary = bk.customer_summary || briefing.buildCustomerSummary({lang, clientName:clientData.name, serviceType:bk.service_type, notes});
    const preferences = rows(tx, "cleaner_preferences", "cleaner = {:id}", {id:cleaner.id});
    const floor = preferences.length ? preferences[0].getFloat("minimum_budget") : 0;
    const booking = record(tx, "bookings", {client:client.id, address:address.id, cleaner:cleaner.id,
      start_time:dates.start, end_time:dates.end, timezone:"Europe/Berlin", estimated_hours:dates.hours,
      service_type:bk.service_type, status:"requested", source:auth ? "dashboard" : "voice-call", calendar_sent:false,
      customer_summary:summary, cleaner_briefing:cleanerBriefing, request_snapshot:p,
      budget_known:bk.budget != null, budget:bk.budget == null ? 0 : bk.budget,
      budget_below_minimum:bk.budget != null && floor > 0 && bk.budget < floor, price:0, price_known:false});
    notes.forEach(n => record(tx, "booking_notes", {booking:booking.id, type:n.type || "note", note:n.note || "",
      note_translated:n.note_translated || "", importance:n.importance || "normal", read_to_cleaner:n.read_to_cleaner !== false}));
    (p.client_preferences || []).forEach(n => record(tx, "client_preferences", {client:client.id, type:n.type || "preference", note:n.note || "",
      note_translated:n.note_translated || "", importance:n.importance || "normal", is_persistent:n.is_persistent !== false}));
    receipt = {status:"created", submission_id:id, booking_id:booking.id, booking_status:"requested", tentative:true,
      cleaner_language:lang, cleaner:{id:cleaner.id,name:cleaner.getString("name"),preferred_language:lang}, cleaner_briefing:cleanerBriefing};
    record(tx, "booking_submissions", {submission_id:id, payload_hash:hash, recovery_hash:auth ? "" : $security.sha256(token),
      booking:booking.id, cleaner:cleaner.id, receipt});
  });
  return receipt;
}
function recover(app, id, auth, token) {
  const found = rows(app, "booking_submissions", "submission_id = {:id}", {id});
  if (!found.length) fail(404, "No persisted receipt found; an in-flight request may still commit.");
  authorize(auth, token, found[0], app);
  return found[0].get("receipt");
}
function decide(app, id, decision, auth) {
  if (!auth || auth.collection().name !== "users") fail(401, "Cleaner authentication required.");
  if (!["confirmed", "declined"].includes(decision)) fail(400, "Choose Confirm or Decline.");
  let result;
  app.runInTransaction(tx => {
    const found = rows(tx, "bookings", "id = {:id} && cleaner.user = {:user}", {id, user:auth.id});
    if (!found.length) fail(404, "Booking not found.");
    const booking = found[0];
    const current = booking.getString("status");
    if (current === "requested") { booking.set("status", decision); tx.save(booking); }
    result = {booking_id:id, booking_status:booking.getString("status"), conflict:current !== "requested" && current !== decision};
  });
  return result;
}
module.exports = {create, recover, decide, configuredCleaner};
