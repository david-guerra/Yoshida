import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homePageSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const calendarSource = readFileSync(
  new URL("../src/components/CalendarCard.tsx", import.meta.url),
  "utf8",
);
const ordersCardSource = readFileSync(
  new URL("../src/components/OrdersCard.tsx", import.meta.url),
  "utf8",
);

test("dashboard home uses a simple page layout instead of a nested white panel", () => {
  assert.doesNotMatch(homePageSource, /rounded-lg border border-\[#e3e9e5\] bg-white/);
  assert.match(homePageSource, /Cleaner Desk/);
  assert.match(homePageSource, /LiveOrdersDashboard/);
});

test("calendar provides a mobile-friendly list and avoids a fixed desktop-only height", () => {
  assert.doesNotMatch(calendarSource, /h-\[700px\]/);
  assert.match(calendarSource, /md:hidden/);
  assert.match(calendarSource, /hidden md:block/);
});

test("orders card links to existing dashboard routes only", () => {
  assert.doesNotMatch(ordersCardSource, /\/past-orders/);
  assert.doesNotMatch(ordersCardSource, /\/future-orders/);
  assert.match(ordersCardSource, /\/orders/);
});
