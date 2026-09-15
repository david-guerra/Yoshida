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
  assert.deepEqual(JSON.parse(requests[0].body), { clientId: "connection-1", subscriptions: ["bookings/*", "booking_notes/*", "client_preferences/*", "clients/*", "addresses/*", "cleaners/*"] });
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

test("Live waits for reconciliation, and recovery restores Live", async (t) => {
  const original = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  t.after(() => { globalThis.EventSource = original; });
  t.mock.method(globalThis, "fetch", async () => ({ok:true}));
  let resolve;
  let read = () => new Promise(r => { resolve = r; });
  const states = [];
  const close = connectBookingRealtime("http://example.test", "token", () => read(), state => states.push(state));
  t.after(close);
  const source = FakeEventSource.instance;
  source.dispatchEvent(new MessageEvent("PB_CONNECT", {lastEventId:"id"}));
  await setImmediate();
  assert.equal(states.includes("live"), false);
  resolve();
  await setImmediate();
  assert.equal(states.at(-1), "live");
  read = async () => { throw new Error("offline"); };
  source.dispatchEvent(new MessageEvent("bookings/*"));
  await setImmediate();
  assert.equal(states.at(-1), "offline");
  read = async () => {};
  source.dispatchEvent(new MessageEvent("booking_notes/*"));
  await setImmediate();
  assert.equal(states.at(-1), "live");
});

test('manual reads during an event outage stay offline; old connection callbacks and cleanup cannot revive Live', async (t) => {
  const original=globalThis.EventSource;
  globalThis.EventSource=FakeEventSource;
  t.after(()=>{globalThis.EventSource=original;});
  t.mock.method(globalThis,'fetch',async()=>({ok:true}));
  let finish;
  const states=[];
  let wait=true;
  const close=connectBookingRealtime('http://example.test','token',()=>wait ? new Promise(r=>{finish=r;}) : Promise.resolve(),s=>states.push(s));
  t.after(close);
  const source=FakeEventSource.instance;
  source.dispatchEvent(new MessageEvent('PB_CONNECT',{lastEventId:'first'}));
  await setImmediate();
  source.onerror();
  finish(); await setImmediate();
  assert.equal(states.at(-1),'offline');
  wait=false; await close.refresh();
  assert.equal(states.at(-1),'offline');
  close(); const count=states.length;
  source.dispatchEvent(new MessageEvent('booking_notes/*'));
  await setImmediate();
  assert.equal(states.length,count);
});

test('reconnect waits increase and cap at 30 seconds', async (t) => {
  const original=globalThis.EventSource;
  globalThis.EventSource=FakeEventSource;
  t.after(()=>{globalThis.EventSource=original;});
  const scheduled=[];
  t.mock.method(globalThis,'setTimeout',(callback,ms)=>{scheduled.push({callback,ms});return scheduled.length;});
  t.mock.method(globalThis,'clearTimeout',()=>{});
  const close=connectBookingRealtime('http://example.test','token',async()=>{},()=>{});
  const delays=[];
  for(let i=0;i<7;i++) {
    FakeEventSource.instance.onerror();
    delays.push(scheduled.at(-1).ms);
    scheduled.at(-1).callback();
  }
  close();
  assert.deepEqual(delays,[1000,2000,4000,8000,16000,30000,30000]);
});
