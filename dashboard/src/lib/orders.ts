import { mapBooking, type OrderRecord, type PocketBaseBooking } from "./orderMapper.ts";
export type { OrderRecord } from "./orderMapper.ts";
export { formatAppointment, formatDate, formatRequestedStart, formatTime } from "./orderMapper.ts";

export type ReadFailure = "unavailable" | "auth" | "setup" | "not-found";
export class BookingReadError extends Error {
  kind: ReadFailure;
  constructor(kind: ReadFailure) {
    super({
      unavailable: "Could not load bookings. Retry.",
      auth: "Your session has changed or expired. Sign in again.",
      setup: "Account setup required: no linked cleaner profile.",
      "not-found": "Booking not found or unavailable to your account.",
    }[kind]);
    this.kind = kind;
  }
}

export type OrderNote = { id: string; type: string; note: string; importance: string; original: string; translation: string | null };
export type OrderDetail = {
  order: OrderRecord;
  notes: OrderNote[];
  preferences: OrderNote[];
  failedSections: string[];
};
export type InboxView = "review" | "upcoming" | "history";
export type OrderQuery =
  | { kind: "inbox"; view: InboxView; page: number; search?: string }
  | { kind: "home" }
  | { kind: "orders"; page: number; view?: string }
  | { kind: "calendar"; from: string; to: string };
export type OrderList = { orders: OrderRecord[]; total: number; page: number; totalPages: number; counts?: Record<InboxView, number> };
type Page<T> = { items: T[]; totalPages: number; totalItems: number; page: number };
type Note = { id: string; type?: string; note?: string; note_translated?: string; importance?: string };

export async function readJson<T>(
  url: string | URL, init: RequestInit = {}, transport: typeof fetch = fetch,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    init.signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(10_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      const response = await transport(url, { ...init, signal, cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new BookingReadError("auth");
        if (response.status === 404) throw new BookingReadError("not-found");
        throw new BookingReadError("unavailable");
      }
      return await response.json() as T;
    } catch (error) {
      init.signal?.throwIfAborted();
      if (error instanceof BookingReadError && error.kind !== "unavailable") throw error;
      if (attempt === 1) throw new BookingReadError("unavailable");
    }
  }
  throw new BookingReadError("unavailable");
}

// No privileged fallback. The caller supplies the current cleaner's session;
// PocketBase rules remain authoritative even for a forged cleaner identifier.
export function createBookingReader(options: {
  baseUrl: string; token: string; cleanerId: string; signal?: AbortSignal; fetch?: typeof fetch;
}) {
  const { baseUrl, token, cleanerId, signal } = options;
  const quote = (value: string) => JSON.stringify(value);
  const request = <T,>(path: string, params?: Record<string, string>, method = "GET") => {
    const url = new URL(path, baseUrl);
    url.search = new URLSearchParams(params).toString();
    if (!token) return Promise.reject<T>(new BookingReadError("auth"));
    return readJson<T>(url, { method, signal, headers: {
      Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true",
    } }, options.fetch);
  };
  const page = async <T,>(collection: string, params: Record<string, string>, number = 1) => {
    const result = await request<Page<T>>(`/api/collections/${collection}/records`, {
      ...params, page: String(number), perPage: "30",
    });
    if (!Array.isArray(result.items) || result.page !== number ||
        !Number.isInteger(result.totalPages) || !Number.isInteger(result.totalItems)) {
      throw new BookingReadError("unavailable");
    }
    return result;
  };
  const collectPages = async <T extends {id:string},>(collection: string, params: Record<string, string>) => {
    const items: T[] = [];
    try {
      const first = await page<T>(collection, params);
      items.push(...first.items);
      for (let next = 2; next <= first.totalPages; next++) {
        const result = await page<T>(collection, params, next);
        if (result.totalItems !== first.totalItems || result.totalPages !== first.totalPages) {
          throw new BookingReadError("unavailable");
        }
        items.push(...result.items);
      }
      if (items.length !== first.totalItems || new Set(items.map(item => item.id)).size !== items.length) {
        throw new BookingReadError("unavailable");
      }
      return { items };
    } catch (error) {
      return { items, error };
    }
  };
  const all = async <T extends {id:string},>(collection: string, params: Record<string, string>) => {
    const result = await collectPages<T>(collection, params);
    if (result.error) throw result.error;
    return result.items;
  };
  const identify = async () => {
    // Invalid auth can otherwise produce a filtered empty PocketBase collection.
    try {
      await request("/api/collections/users/auth-refresh", undefined, "POST");
    } catch (error) {
      if (error instanceof BookingReadError && error.kind === "not-found") throw new BookingReadError("auth");
      throw error;
    }
    const profiles = await all<{id:string}>("cleaners", { sort: "id" });
    if (!profiles.length) throw new BookingReadError("setup");
    if (!profiles.some(profile => profile.id === cleanerId)) throw new BookingReadError("auth");
  };
  const note = (item: Note): OrderNote => ({
    id: item.id, type: item.type || "Note", importance: item.importance || "normal",
    note: item.note_translated || item.note || "",
    original: item.note || "", translation: item.note_translated || null,
  });
  return {
    async list(query: OrderQuery): Promise<OrderList> {
      await identify();
      let filter = `cleaner = ${quote(cleanerId)}`;
      if (query.kind === "orders") {
        const now = quote(new Date().toISOString().replace("T", " "));
        if (query.view === "needs-approval") filter += ' && status = "requested"';
        if (query.view === "past") filter += ` && end_time != "" && end_time < ${now}`;
        if (query.view === "future") filter += ` && start_time != "" && end_time > start_time && end_time >= ${now}`;
      }
      if (query.kind === "calendar") {
        filter += ` && (status = "requested" || status = "confirmed") && start_time < ${quote(query.to.replace("T", " "))} && end_time > ${quote(query.from.replace("T", " "))} && end_time > start_time`;
      }
      const params = { filter, sort: "-created,-id", expand: "client,address" };
      if (query.kind === "orders") {
        const result = await page<PocketBaseBooking>("bookings", params, query.page);
        return { orders: result.items.map(mapBooking), total: result.totalItems, totalPages: result.totalPages, page: result.page };
      }
      const items = await all<PocketBaseBooking>("bookings", params);
      const orders = items.map(mapBooking);
      if (query.kind === "inbox") {
        const groups = {
          review: orders.filter(order => order.needsReview),
          upcoming: orders.filter(order => order.status === "Confirmed" && order.category === "upcoming"),
          history: orders.filter(order => !order.needsReview && !(order.status === "Confirmed" && order.category === "upcoming")),
        };
        const search = query.search?.trim().toLocaleLowerCase() ?? "";
        const matches = groups[query.view].filter(order =>
          [order.customerName, order.customerPhone, order.location, order.service, order.orderId]
            .some(value => value.toLocaleLowerCase().includes(search)));
        const totalPages = Math.max(1, Math.ceil(matches.length / 6));
        const page = Math.min(totalPages, Math.max(1, Math.floor(query.page) || 1));
        return {orders: matches.slice((page - 1) * 6, page * 6), total: matches.length, page, totalPages,
          counts: {review: groups.review.length, upcoming: groups.upcoming.length, history: groups.history.length}};
      }
      return { orders, total: items.length, page: 1, totalPages: 1 };
    },
    async detail(id: string): Promise<OrderDetail> {
      await identify();
      const booking = await request<PocketBaseBooking & {cleaner?: string}>(
        `/api/collections/bookings/records/${encodeURIComponent(id)}`, { expand: "client,address" },
      );
      if (booking.cleaner !== cleanerId) throw new BookingReadError("not-found");
      const order = mapBooking(booking);
      const failedSections: string[] = [];
      const section = async (name: string, collection: string, filter: string) => {
        const {items, error} = await collectPages<Note>(collection, {filter, sort:"-importance,id"});
        if (error) {
          if (signal?.aborted || error instanceof BookingReadError && error.kind === "auth") throw error;
          failedSections.push(name);
        }
        return items.map(note);
      };
      const [notes, preferences] = await Promise.all([
        section("Booking notes", "booking_notes", `booking = ${quote(id)}`),
        booking.client ? section("Client preferences", "client_preferences", `client = ${quote(booking.client)}`) : Promise.resolve([]),
      ]);
      // Failed expansions must not silently masquerade as successfully absent data.
      if ((booking.request_snapshot?.client?.name == null || booking.request_snapshot?.caller_phone == null) && booking.client && !booking.expand?.client) failedSections.push("Client");
      if (!booking.request_snapshot?.address && booking.address && !booking.expand?.address) failedSections.push("Address");
      return { order, notes, preferences, failedSections };
    },
  };
}
