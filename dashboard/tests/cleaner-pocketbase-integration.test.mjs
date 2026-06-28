import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const authSource = readFileSync(
  new URL("../src/lib/auth.ts", import.meta.url),
  "utf8",
);
const ordersSource = readFileSync(
  new URL("../src/lib/orders.ts", import.meta.url),
  "utf8",
);
const pocketBaseSource = readFileSync(
  new URL("../src/lib/pocketbase.ts", import.meta.url),
  "utf8",
);
const loginActionsSource = readFileSync(
  new URL("../src/app/login/actions.ts", import.meta.url),
  "utf8",
);
const homePageSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const liveDashboardSource = readFileSync(
  new URL("../src/components/LiveOrdersDashboard.tsx", import.meta.url),
  "utf8",
);
const cleanerPreferencesSource = readFileSync(
  new URL("../src/lib/cleanerPreferences.ts", import.meta.url),
  "utf8",
);
const settingsActionsSource = readFileSync(
  new URL("../src/app/settings/actions.ts", import.meta.url),
  "utf8",
);

test("cleaner login authenticates against PocketBase users and stores a cleaner session", () => {
  assert.match(
    authSource,
    /\/api\/collections\/users\/auth-with-password/,
  );
  assert.match(authSource, /filter:\s*`user = "\$\{user\.id\}"/);
  assert.match(authSource, /filter:\s*`email = "\$\{user\.email\}"/);
  assert.match(authSource, /cleanvoice_cleaner_token/);
  assert.match(authSource, /cleanvoice_cleaner_id/);
  assert.match(authSource, /httpOnly:\s*true/);
  assert.match(authSource, /sameSite:\s*"lax"/);
  assert.doesNotMatch(loginActionsSource, /PB_ADMIN_PASSWORD/);
});

test("protected dashboard reads cleaner identity from the PocketBase session", () => {
  assert.match(authSource, /requireCleanerSession/);
  assert.match(authSource, /cleanvoice_cleaner_id/);
  assert.match(homePageSource, /await requireCleanerSession\(\)/);
  assert.match(homePageSource, /getOrders\(session\.cleanerId/);
  assert.doesNotMatch(homePageSource, /NEXT_PUBLIC_CLEANER_ID/);
});

test("orders never fall back to mock data or a baked cleaner id", () => {
  assert.doesNotMatch(ordersSource, /mockOrders/);
  assert.doesNotMatch(ordersSource, /4bv09jvfeljswjj/);
  assert.doesNotMatch(ordersSource, /return\s+default/i);
  assert.match(ordersSource, /getOrders\(cleanerId:\s*string/);
  assert.match(ordersSource, /filter:\s*`cleaner = "\$\{cleanerId\}"/);
});

test("dashboard subscribes to PocketBase realtime and refreshes cleaner bookings", () => {
  assert.match(liveDashboardSource, /new EventSource\(/);
  assert.match(liveDashboardSource, /\/api\/realtime/);
  assert.match(liveDashboardSource, /\/api\/collections\/bookings\/records/);
  assert.match(liveDashboardSource, /collection === "bookings"/);
});

test("dashboard public PocketBase URL falls back to the shared server env", () => {
  assert.match(
    pocketBaseSource,
    /export function getPublicPocketBaseUrl\(\) \{[\s\S]*process\.env\.NEXT_PUBLIC_POCKETBASE_URL[\s\S]*process\.env\.POCKETBASE_URL[\s\S]*"http:\/\/127\.0\.0\.1:8090"[\s\S]*\}/,
  );
});

test("cleaner language is stored on the cleaner record and defaults to English", () => {
  assert.match(cleanerPreferencesSource, /export function normalizeCleanerLanguage/);
  assert.match(cleanerPreferencesSource, /preferred_language:\s*normalizeCleanerLanguage/);
  assert.match(settingsActionsSource, /normalizeCleanerLanguage/);
  assert.match(
    settingsActionsSource,
    /preferred_language:\s*normalizeCleanerLanguage\(\s*value\(formData,\s*"preferredLanguage"\),\s*\)/,
  );
});
