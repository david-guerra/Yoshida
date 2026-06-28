import {
  formatAppointment,
  formatDate,
  formatTime,
  mapBooking,
  type OrderRecord,
  type PocketBaseBooking,
} from "@/src/lib/orderMapper";
import { pocketBaseRequest } from "@/src/lib/pocketbase";

export type { OrderRecord } from "@/src/lib/orderMapper";
export { formatAppointment, formatDate, formatTime };

export type OrderNote = {
  id: string;
  type: string;
  note: string;
  importance: string;
  readToCleaner: boolean;
};

export type ClientPreference = {
  id: string;
  type: string;
  note: string;
  importance: string;
  isPersistent: boolean;
};

export type OrderDetail = {
  order: OrderRecord;
  notes: OrderNote[];
  preferences: ClientPreference[];
};

type PocketBaseList<T> = {
  items?: T[];
};

type PocketBaseNote = {
  id: string;
  type?: string;
  note?: string;
  note_translated?: string;
  importance?: string;
  read_to_cleaner?: boolean;
};

type PocketBasePreference = {
  id: string;
  type?: string;
  note?: string;
  note_translated?: string;
  importance?: string;
  is_persistent?: boolean;
};

export async function getOrders(cleanerId: string, token?: string) {
  const params = new URLSearchParams({
    filter: `cleaner = "${cleanerId}"`,
    sort: "start_time",
    expand: "client,address,cleaner",
  });

  const data = await pocketBaseRequest<PocketBaseList<PocketBaseBooking>>(
    "/api/collections/bookings/records",
    { auth: token ? "none" : "optional", params, token },
  );

  return (data.items ?? []).map(mapBooking);
}

async function getBookingNotes(orderId: string, token?: string) {
  const params = new URLSearchParams({
    filter: `booking = "${orderId}"`,
    sort: "-importance",
  });

  const data = await pocketBaseRequest<PocketBaseList<PocketBaseNote>>(
    "/api/collections/booking_notes/records",
    { auth: token ? "none" : "optional", params, token },
  );

  return (
    data.items?.map((item) => ({
      id: item.id,
      type: item.type ?? "other",
      note: item.note_translated || item.note || "",
      importance: item.importance ?? "normal",
      readToCleaner: Boolean(item.read_to_cleaner),
    })) ?? []
  );
}

async function getClientPreferences(customerId: string, token?: string) {
  if (customerId === "Not set") {
    return [];
  }

  const params = new URLSearchParams({
    filter: `client = "${customerId}"`,
    sort: "-importance",
  });

  const data = await pocketBaseRequest<PocketBaseList<PocketBasePreference>>(
    "/api/collections/client_preferences/records",
    { auth: token ? "none" : "optional", params, token },
  );

  return (
    data.items?.map((item) => ({
      id: item.id,
      type: item.type ?? "preference",
      note: item.note_translated || item.note || "",
      importance: item.importance ?? "normal",
      isPersistent: Boolean(item.is_persistent),
    })) ?? []
  );
}

export async function getOrder(
  orderId: string,
  cleanerId: string,
  token?: string,
): Promise<OrderDetail | null> {
  const order = (await getOrders(cleanerId, token)).find(
    (item) => item.orderId === orderId,
  );

  if (!order) {
    return null;
  }

  const [notes, preferences] = await Promise.all([
    getBookingNotes(order.orderId, token),
    getClientPreferences(order.customerId, token),
  ]);

  return { order, notes, preferences };
}
