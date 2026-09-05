import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { connectBookingRealtime } from "../src/lib/bookingRealtime.ts";

class FakeEventSource extends EventTarget {
  static instance;
  constructor() { super(); FakeEventSource.instance = this; }
  close() { this.closed = true; }
}

test("named PocketBase events subscribe, refresh and clean up", async (t) => {
  const original = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  t.after(() => { globalThis.EventSource = original; });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), ...options });
    return { ok: true };
  });
  const states = [];
  let refreshed = 0;
  const close = connectBookingRealtime("http://127.0.0.1:8090", "synthetic-token", async () => { refreshed++; }, (state) => states.push(state));
  const source = FakeEventSource.instance;
  source.dispatchEvent(new MessageEvent("PB_CONNECT", { lastEventId: "connection-1", data: '{"clientId":"connection-1"}' }));
  await setImmediate();
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].body), { clientId: "connection-1", subscriptions: ["bookings/*"] });
  assert.equal(requests[0].headers.Authorization, "Bearer synthetic-token");
  assert.equal(states.at(-1), "live");
  const before = refreshed;
  source.dispatchEvent(new MessageEvent("bookings/*", { data: '{"action":"create","record":{"collectionName":"bookings"}}' }));
  await setImmediate();
  assert.equal(refreshed, before + 1);
  close();
  assert.equal(source.closed, true);
});

test("a rejected subscription never reports live", async (t) => {
  const original = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  t.after(() => { globalThis.EventSource = original; });
  t.mock.method(globalThis, "fetch", async () => ({ ok: false }));
  const states = [];
  const close = connectBookingRealtime("http://127.0.0.1:8090", "synthetic-token", async () => {}, (state) => states.push(state));
  FakeEventSource.instance.dispatchEvent(new MessageEvent("PB_CONNECT", { lastEventId: "connection-1", data: '{"clientId":"connection-1"}' }));
  await setImmediate();
  assert.equal(states.at(-1), "offline");
  assert.equal(states.includes("live"), false);
  close();
});
