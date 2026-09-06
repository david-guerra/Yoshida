/// <reference path="../pb_data/types.d.ts" />
//
// CleanVoice agent endpoints.
//
// The Python voice agent (client-call-agent) talks to these custom routes
// instead of the standard collections API. They reconstruct the behaviour the
// agent expects: caller identification, cleaner briefing/preferences, cleaner
// suggestion, and tentative booking creation.
//
// NOTE: each handler runs in an isolated VM, so shared helpers can't be closed
// over — they are inlined per route.

// POST /api/cleanvoice/identify-caller  { caller_phone }
//   -> { lookup_status, role: cleaner|existing_client|new_client, caller_phone, ... }
routerAdd("POST", "/api/cleanvoice/identify-caller", (e) => {
  const body = e.requestInfo().body || {};
  const phone = (body.caller_phone || "").toString();
  const want = phone.replace(/[^0-9]/g, "");

  const findByPhone = (collection) => {
    try {
      const r = $app.findFirstRecordByFilter(collection, "phone = {:p}", { p: phone });
      if (r) return r;
    } catch (_) {}
    if (!want) return null;
    try {
      const all = $app.findRecordsByFilter(collection, "id != ''", "", 500, 0);
      for (let i = 0; i < all.length; i++) {
        if ((all[i].get("phone") || "").toString().replace(/[^0-9]/g, "") === want) {
          return all[i];
        }
      }
    } catch (_) {}
    return null;
  };

  const cleaner = findByPhone("cleaners");
  if (cleaner) {
    return e.json(200, {
      lookup_status: "available",
      role: "cleaner",
      caller_phone: phone,
      cleaner: {
        id: cleaner.id,
        name: cleaner.get("name"),
        preferred_language: cleaner.get("preferred_language") || "en",
      },
    });
  }

  const client = findByPhone("clients");
  if (client) {
    return e.json(200, {
      lookup_status: "available",
      role: "existing_client",
      caller_phone: phone,
      client: {
        id: client.id,
        name: client.get("name"),
        preferred_language: client.get("preferred_language") || "de",
      },
    });
  }

  return e.json(200, {
    lookup_status: "available",
    role: "new_client",
    caller_phone: phone,
  });
});

// GET /api/cleanvoice/cleaner-briefing?phone=  -> { briefing, preferred_language }
routerAdd("GET", "/api/cleanvoice/cleaner-briefing", (e) => {
  const phone = (e.requestInfo().query.phone || "").toString();
  const want = phone.replace(/[^0-9]/g, "");

  let cleaner = null;
  try {
    cleaner = $app.findFirstRecordByFilter("cleaners", "phone = {:p}", { p: phone });
  } catch (_) {}
  if (!cleaner && want) {
    try {
      const all = $app.findRecordsByFilter("cleaners", "id != ''", "", 500, 0);
      for (let i = 0; i < all.length; i++) {
        if ((all[i].get("phone") || "").toString().replace(/[^0-9]/g, "") === want) {
          cleaner = all[i];
          break;
        }
      }
    } catch (_) {}
  }
  if (!cleaner) return e.json(404, { message: "Cleaner not found for phone." });

  let future = [];
  try {
    const rows = $app.findRecordsByFilter("bookings", "cleaner = {:c}", "start_time", 50, 0, {
      c: cleaner.id,
    });
    const now = Date.now();
    future = rows.filter((b) => {
      const t = new Date((b.get("start_time") || "").toString()).getTime();
      return !isNaN(t) && t >= now;
    });
  } catch (_) {}

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
});

// GET /api/cleanvoice/cleaner-preferences?phone=  -> cleaner profile + preferences
routerAdd("GET", "/api/cleanvoice/cleaner-preferences", (e) => {
  const phone = (e.requestInfo().query.phone || "").toString();
  const want = phone.replace(/[^0-9]/g, "");

  let cleaner = null;
  try {
    cleaner = $app.findFirstRecordByFilter("cleaners", "phone = {:p}", { p: phone });
  } catch (_) {}
  if (!cleaner && want) {
    try {
      const all = $app.findRecordsByFilter("cleaners", "id != ''", "", 500, 0);
      for (let i = 0; i < all.length; i++) {
        if ((all[i].get("phone") || "").toString().replace(/[^0-9]/g, "") === want) {
          cleaner = all[i];
          break;
        }
      }
    } catch (_) {}
  }
  if (!cleaner) return e.json(404, { message: "Cleaner not found for phone." });

  let pref = null;
  try {
    pref = $app.findFirstRecordByFilter("cleaner_preferences", "cleaner = {:c}", { c: cleaner.id });
  } catch (_) {}

  const lang = cleaner.get("preferred_language") || "en";
  const get = (field, fallback) => (pref ? pref.get(field) : fallback);

  return e.json(200, {
    lookup_status: "available",
    cleaner_language: lang,
    preferred_language: lang,
    cleaner: { id: cleaner.id, name: cleaner.get("name"), preferred_language: lang },
    working_days: get("working_days", []),
    available_start_time: get("available_start_time", ""),
    available_end_time: get("available_end_time", ""),
    service_locations: get("service_locations", cleaner.get("service_areas") || []),
    preferred_services: get("preferred_services", cleaner.get("skills") || []),
    minimum_budget: get("minimum_budget", 0),
    business_rules: get("business_rules", ""),
    exceptions: get("exceptions", []),
  });
});

// POST /api/cleanvoice/suggest-cleaner  { service_type, city, postal_code, start_time, estimated_budget }
//   -> { available, cleaner_phone, cleaner, warnings }
routerAdd("POST", "/api/cleanvoice/suggest-cleaner", (e) => {
  const req = e.requestInfo().body || {};

  let cleaners = [];
  try {
    cleaners = $app.findRecordsByFilter("cleaners", "active = true", "", 50, 0);
  } catch (_) {}
  if (!cleaners || !cleaners.length) {
    try {
      cleaners = $app.findRecordsByFilter("cleaners", "id != ''", "", 50, 0);
    } catch (_) {}
  }
  if (!cleaners || !cleaners.length) {
    return e.json(200, { available: false, message: "No cleaner is available right now." });
  }

  const cleaner = cleaners[0];
  const warnings = [];

  // Soft checks against stored preferences (informational only).
  try {
    const pref = $app.findFirstRecordByFilter("cleaner_preferences", "cleaner = {:c}", {
      c: cleaner.id,
    });
    if (pref) {
      const budget = Number(req.estimated_budget);
      const floor = Number(pref.get("minimum_budget"));
      if (!isNaN(budget) && budget > 0 && !isNaN(floor) && floor > 0 && budget < floor) {
        warnings.push("Requested budget is below the cleaner's minimum.");
      }
    }
  } catch (_) {}

  return e.json(200, {
    available: true,
    cleaner_phone: cleaner.get("phone") || "",
    cleaner: {
      id: cleaner.id,
      name: cleaner.get("name"),
      preferred_language: cleaner.get("preferred_language") || "en",
    },
    warnings,
  });
});

// POST /api/cleanvoice/create-booking  { caller_phone, cleaner_phone?, cleaner_language,
//   cleaner, client, address, booking, booking_notes[], client_preferences[] }
//   -> { status, booking_id, cleaner_language, cleaner_briefing, tentative }
routerAdd("POST", "/api/cleanvoice/create-booking", (e) => {
  const p = e.requestInfo().body || {};
  const norm = (s) => (s || "").toString().replace(/[^0-9]/g, "");

  // --- resolve the cleaner the booking is assigned to ---
  let cleaner = null;
  const cphone = (p.cleaner_phone || "").toString();
  if (cphone) {
    try {
      cleaner = $app.findFirstRecordByFilter("cleaners", "phone = {:p}", { p: cphone });
    } catch (_) {}
    if (!cleaner) {
      try {
        const all = $app.findRecordsByFilter("cleaners", "id != ''", "", 200, 0);
        const want = norm(cphone);
        for (let i = 0; i < all.length; i++) {
          if (norm(all[i].get("phone")) === want) {
            cleaner = all[i];
            break;
          }
        }
      } catch (_) {}
    }
  }
  if (!cleaner) {
    let act = [];
    try {
      act = $app.findRecordsByFilter("cleaners", "active = true", "", 1, 0);
    } catch (_) {}
    if (!act || !act.length) {
      try {
        act = $app.findRecordsByFilter("cleaners", "id != ''", "", 1, 0);
      } catch (_) {}
    }
    if (act && act.length) cleaner = act[0];
  }
  if (!cleaner) {
    return e.json(400, { status: "error", message: "No cleaner available to assign." });
  }

  // --- upsert the client by caller phone ---
  const callerPhone = (p.caller_phone || "").toString();
  const clientData = p.client || {};
  let client = null;
  if (callerPhone) {
    try {
      client = $app.findFirstRecordByFilter("clients", "phone = {:p}", { p: callerPhone });
    } catch (_) {}
  }
  if (!client) {
    client = new Record($app.findCollectionByNameOrId("clients"));
    client.set("phone", callerPhone);
    client.set("status", "new");
  }
  if (clientData.name) client.set("name", clientData.name);
  if (clientData.email) client.set("email", clientData.email);
  client.set(
    "preferred_language",
    clientData.preferred_language || client.get("preferred_language") || "de",
  );
  $app.save(client);

  // --- address ---
  const addr = p.address || {};
  const address = new Record($app.findCollectionByNameOrId("addresses"));
  address.set("client", client.id);
  address.set("label", addr.label || "Booking address");
  address.set("is_default", true);
  address.set("street", addr.street || "");
  address.set("postal_code", addr.postal_code || "");
  address.set("city", addr.city || "");
  address.set("country", addr.country || "DE");
  address.set("access_notes", addr.access_notes || "");
  $app.save(address);

  // --- booking ---
  const bk = p.booking || {};
  const notesArr = Array.isArray(p.booking_notes) ? p.booking_notes : [];
  const start = (bk.start_time || "").toString();
  let end = (bk.end_time || "").toString();
  const hours = Number(bk.estimated_hours) || 0;
  if (!end && start && hours > 0) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) end = new Date(d.getTime() + hours * 3600 * 1000).toISOString();
  }

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

  const booking = new Record($app.findCollectionByNameOrId("bookings"));
  booking.set("client", client.id);
  booking.set("address", address.id);
  booking.set("cleaner", cleaner.id);
  if (start) booking.set("start_time", start);
  if (end) booking.set("end_time", end);
  booking.set("status", "requested");
  booking.set("service_type", bk.service_type || "");
  if (hours > 0) booking.set("estimated_hours", hours);
  booking.set("customer_summary", customerSummary);
  booking.set("cleaner_briefing", cleanerBriefing);
  booking.set("calendar_sent", false);
  booking.set("source", "voice-call");
  $app.save(booking);

  // --- booking notes ---
  for (let i = 0; i < notesArr.length; i++) {
    const n = notesArr[i];
    if (!n) continue;
    const rec = new Record($app.findCollectionByNameOrId("booking_notes"));
    rec.set("booking", booking.id);
    rec.set("type", n.type || "note");
    rec.set("note", n.note || "");
    rec.set("note_translated", n.note_translated || "");
    rec.set("importance", n.importance || "normal");
    rec.set("read_to_cleaner", n.read_to_cleaner !== false);
    $app.save(rec);
  }

  // --- client preferences ---
  const prefsArr = Array.isArray(p.client_preferences) ? p.client_preferences : [];
  for (let i = 0; i < prefsArr.length; i++) {
    const pr = prefsArr[i];
    if (!pr) continue;
    const rec = new Record($app.findCollectionByNameOrId("client_preferences"));
    rec.set("client", client.id);
    rec.set("type", pr.type || "preference");
    rec.set("note", pr.note || "");
    rec.set("note_translated", pr.note_translated || "");
    rec.set("importance", pr.importance || "normal");
    rec.set("is_persistent", pr.is_persistent !== false);
    $app.save(rec);
  }

  return e.json(200, {
    status: "created",
    booking_id: booking.id,
    booking_status: "requested",
    tentative: true,
    cleaner_language: lang,
    cleaner: { id: cleaner.id, name: cleaner.get("name"), preferred_language: lang },
    cleaner_briefing: cleanerBriefing,
  });
});
