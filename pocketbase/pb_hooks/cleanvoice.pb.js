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

  const contract = require(`${__hooks}/booking_contract.js`);
  let cleaner;
  try { cleaner = contract.configuredCleaner($app); }
  catch (_) { return e.json(200, {available:false, message:"The configured active cleaner is unavailable."}); }
  const warnings = [];

  // Soft checks against stored preferences (informational only).
  try {
    const pref = $app.findFirstRecordByFilter("cleaner_preferences", "cleaner = {:c}", {
      c: cleaner.id,
    });
    if (pref) {
      const budget = req.estimated_budget;
      const floor = Number(pref.get("minimum_budget"));
      if (typeof budget === "number" && isFinite(budget) && budget >= 0 && !isNaN(floor) && floor > 0 && budget < floor) {
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

// Transactional create and scoped, immutable receipt recovery.
routerAdd("POST", "/api/cleanvoice/create-booking", (e) => {
  if (!e.auth && e.request.header.get("Authorization")) {
    return e.json(401, { message: "Your cleaner session has expired. Sign in again." });
  }
  const contract = require(`${__hooks}/booking_contract.js`);
  return e.json(200, contract.create($app, e.requestInfo().body || {}, e.auth, e.request.header.get("X-Submission-Token")));
});
routerAdd("GET", "/api/cleanvoice/submissions/{submissionId}", (e) => {
  if (!e.auth && e.request.header.get("Authorization")) {
    return e.json(401, { message: "Your cleaner session has expired. Sign in again." });
  }
  const contract = require(`${__hooks}/booking_contract.js`);
  return e.json(200, contract.recover($app, e.request.pathValue("submissionId"), e.auth, e.request.header.get("X-Submission-Token")));
});
routerAdd("POST", "/api/cleanvoice/bookings/{bookingId}/decision", (e) => {
  const contract = require(`${__hooks}/booking_contract.js`);
  const result = contract.decide($app, e.request.pathValue("bookingId"), (e.requestInfo().body || {}).decision, e.auth);
  return e.json(result.conflict ? 409 : 200, result);
});
