import assert from "node:assert/strict";
import { test } from "node:test";
import { createBookingReader } from "../src/lib/orders.ts";

test("review notes and preferences prefer translated text and fall back to the original", async () => {
  const reader = createBookingReader({
    baseUrl:"http://example.test", token:"owner-token", cleanerId:"owner",
    fetch:async url => {
      const path = new URL(url).pathname;
      if (path.endsWith("auth-refresh")) return Response.json({record:{id:"user"}});
      if (path.includes("/cleaners/")) return Response.json({items:[{id:"owner"}],page:1,totalPages:1,totalItems:1});
      if (path.includes("/bookings/")) return Response.json({
        id:"booking",cleaner:"owner",client:"client",expand:{client:{id:"client"}},
      });
      return Response.json({page:1,totalPages:1,totalItems:2,items:[
        {id:"translated",note:"Original note",note_translated:"Translated note"},
        {id:"original",note:"Original fallback",note_translated:""},
      ]});
    },
  });
  const detail = await reader.detail("booking");
  assert.deepEqual(detail.notes.map(item=>item.note),["Translated note","Original fallback"]);
  assert.deepEqual(detail.preferences.map(item=>item.note),["Translated note","Original fallback"]);
});
