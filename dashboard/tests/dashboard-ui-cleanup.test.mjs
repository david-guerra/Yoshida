import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homePageSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const ordersCardSource = readFileSync(
  new URL("../src/components/OrdersCard.tsx", import.meta.url),
  "utf8",
);
const ordersPageSource = readFileSync(
  new URL("../src/app/orders/page.tsx", import.meta.url),
  "utf8",
);

test("dashboard home uses a simple page layout instead of a nested white panel", () => {
  assert.doesNotMatch(homePageSource, /rounded-lg border border-\[#e3e9e5\] bg-white/);
  assert.match(homePageSource, /Yoshida/);
  assert.match(homePageSource, /LiveOrdersDashboard/);
});

test("orders card links to existing dashboard routes only", () => {
  assert.doesNotMatch(ordersCardSource, /\/past-orders/);
  assert.doesNotMatch(ordersCardSource, /\/future-orders/);
  assert.match(ordersCardSource, /\/orders/);
});

test("legacy orders page uses the same live request inbox", () => {
  assert.match(ordersPageSource, /LiveOrdersDashboard/);
  assert.match(ordersPageSource, /initialView=/);
});
