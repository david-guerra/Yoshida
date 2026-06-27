export type OrderStatus =
  | "Requested"
  | "Tentative"
  | "Needs approval"
  | "Confirmed"
  | "Completed"
  | "Assigned"
  | "Cancelled";

export type OrderTone = "amber" | "green" | "red";

export type OrderRecord = {
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  start: Date;
  end: Date;
  location: string;
  service: string;
  price: string;
  status: OrderStatus | string;
  tone: OrderTone;
  createdAt: string;
  summary: string;
  cleanerBriefing: string;
  estimatedHours: string;
  accessNotes: string;
  category: "upcoming" | "past";
};

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

const CLEANER_ID =
  process.env.NEXT_PUBLIC_CLEANER_ID ??
  process.env.CLEANER_ID ??
  "4bv09jvfeljswjj";

import { pocketBaseRequest } from "@/src/lib/pocketbase";

export const mockOrders: OrderRecord[] = [
  {
    orderId: "CV-1042",
    customerId: "CUS-2107",
    customerName: "Frau Schneider",
    customerPhone: "+49 170 2000001",
    customerEmail: "schneider@example.com",
    start: new Date(2026, 5, 22, 9, 0),
    end: new Date(2026, 5, 22, 10, 30),
    location: "Prenzlauer Berg",
    service: "Apartment cleaning",
    price: "120 EUR",
    status: "Tentative",
    tone: "amber",
    createdAt: "2026-06-18 14:22",
    summary: "Two-room apartment, weekly interest, cleaner approval needed.",
    cleanerBriefing: "Confirm weekly availability before accepting.",
    estimatedHours: "1.5",
    accessNotes: "Client will open the door.",
    category: "upcoming",
  },
  {
    orderId: "CV-1041",
    customerId: "CUS-2106",
    customerName: "Herr Muller",
    customerPhone: "+49 170 2000002",
    customerEmail: "mueller@example.com",
    start: new Date(2026, 5, 23, 11, 0),
    end: new Date(2026, 5, 23, 12, 0),
    location: "Kreuzberg",
    service: "Move-out cleaning",
    price: "240 EUR",
    status: "Needs approval",
    tone: "amber",
    createdAt: "2026-06-18 13:05",
    summary: "Move-out clean before handover, asks for windows if available.",
    cleanerBriefing: "Ask client to confirm whether windows are included.",
    estimatedHours: "1",
    accessNotes: "Meet at building entrance.",
    category: "upcoming",
  },
  {
    orderId: "CV-1040",
    customerId: "CUS-2105",
    customerName: "Frau Yilmaz",
    customerPhone: "+49 170 2000003",
    customerEmail: "yilmaz@example.com",
    start: new Date(2026, 5, 25, 13, 30),
    end: new Date(2026, 5, 25, 15, 0),
    location: "Neukolln",
    service: "Recurring cleaning",
    price: "95 EUR",
    status: "Confirmed",
    tone: "green",
    createdAt: "2026-06-17 16:48",
    summary: "Recurring Thursday afternoon cleaning for family apartment.",
    cleanerBriefing: "Recurring client, bring standard apartment kit.",
    estimatedHours: "1.5",
    accessNotes: "Door code shared by client.",
    category: "upcoming",
  },
  {
    orderId: "CV-1039",
    customerId: "CUS-2099",
    customerName: "Herr Becker",
    customerPhone: "+49 170 2000004",
    customerEmail: "becker@example.com",
    start: new Date(2026, 5, 26, 9, 15),
    end: new Date(2026, 5, 26, 10, 45),
    location: "Charlottenburg",
    service: "Apartment cleaning",
    price: "110 EUR",
    status: "Completed",
    tone: "green",
    createdAt: "2026-06-14 10:18",
    summary: "One-time apartment clean completed after client confirmation.",
    cleanerBriefing: "Client was satisfied and may book again.",
    estimatedHours: "1.5",
    accessNotes: "No special access notes.",
    category: "past",
  },
  {
    orderId: "CV-1038",
    customerId: "CUS-2098",
    customerName: "Frau Hoffmann",
    customerPhone: "+49 170 2000005",
    customerEmail: "hoffmann@example.com",
    start: new Date(2026, 5, 26, 11, 30),
    end: new Date(2026, 5, 26, 12, 30),
    location: "Mitte",
    service: "Move-out cleaning",
    price: "260 EUR",
    status: "Completed",
    tone: "green",
    createdAt: "2026-06-13 09:31",
    summary: "Move-out clean completed, client may rebook for new flat.",
    cleanerBriefing: "Potential future client after move.",
    estimatedHours: "1",
    accessNotes: "Key handover with client.",
    category: "past",
  },
];

type PocketBaseList<T> = {
  items?: T[];
};

type PocketBaseBooking = {
  id: string;
  client?: string;
  address?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  service_type?: string;
  estimated_hours?: number | string;
  customer_summary?: string;
  cleaner_briefing?: string;
  created?: string;
  created_at?: string;
  price?: string | number;
  budget?: string | number;
  expand?: {
    client?: {
      id?: string;
      name?: string;
      phone?: string;
      email?: string;
    };
    address?: {
      street?: string;
      postal_code?: string;
      city?: string;
      country?: string;
      access_notes?: string;
      label?: string;
    };
  };
};

type PocketBaseNote = {
  id: string;
  type?: string;
  note?: string;
  importance?: string;
  read_to_cleaner?: boolean;
};

type PocketBasePreference = {
  id: string;
  type?: string;
  note?: string;
  importance?: string;
  is_persistent?: boolean;
};

function getTone(status: string): OrderTone {
  const normalized = status.toLowerCase();

  if (normalized.includes("cancel")) {
    return "red";
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("confirm") ||
    normalized.includes("assigned")
  ) {
    return "green";
  }

  return "amber";
}

function getCategory(end: Date): "upcoming" | "past" {
  return end.getTime() < Date.now() ? "past" : "upcoming";
}

function normalizeStatus(status: string | undefined) {
  if (!status) {
    return "Tentative";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatServiceType(serviceType: string | undefined) {
  if (!serviceType) {
    return "Not set";
  }

  return serviceType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddress(booking: PocketBaseBooking) {
  const address = booking.expand?.address;

  if (!address) {
    return "Not set";
  }

  return [address.street, address.postal_code, address.city]
    .filter(Boolean)
    .join(", ");
}

function mapBooking(record: PocketBaseBooking): OrderRecord {
  const start = record.start_time ? new Date(record.start_time) : new Date();
  const end = record.end_time ? new Date(record.end_time) : start;
  const status = normalizeStatus(record.status);

  return {
    orderId: record.id,
    customerId: record.expand?.client?.id ?? record.client ?? "Not set",
    customerName: record.expand?.client?.name ?? "Unknown client",
    customerPhone: record.expand?.client?.phone ?? "Not set",
    customerEmail: record.expand?.client?.email ?? "Not set",
    start,
    end,
    location: formatAddress(record),
    service: formatServiceType(record.service_type),
    price:
      record.price !== undefined
        ? `${record.price}`
        : record.budget !== undefined
          ? `${record.budget}`
          : "Not set",
    status,
    tone: getTone(status),
    createdAt: record.created_at ?? record.created ?? "Not set",
    summary: record.customer_summary ?? "No summary saved yet.",
    cleanerBriefing: record.cleaner_briefing ?? "No cleaner briefing saved yet.",
    estimatedHours:
      record.estimated_hours !== undefined ? `${record.estimated_hours}` : "Not set",
    accessNotes: record.expand?.address?.access_notes ?? "Not set",
    category: getCategory(end),
  };
}

export async function getOrders() {
  try {
    const params = new URLSearchParams({
      filter: `cleaner = "${CLEANER_ID}"`,
      sort: "start_time",
      expand: "client,address,cleaner",
    });

    const data = await pocketBaseRequest<PocketBaseList<PocketBaseBooking>>(
      "/api/collections/bookings/records",
      { params },
    );

    if (!data.items?.length) {
      return mockOrders;
    }

    return data.items.map(mapBooking);
  } catch {
    return mockOrders;
  }
}

async function getBookingNotes(orderId: string) {
  try {
    const params = new URLSearchParams({
      filter: `booking = "${orderId}"`,
      sort: "-importance",
    });

    const data = await pocketBaseRequest<PocketBaseList<PocketBaseNote>>(
      "/api/collections/booking_notes/records",
      { params },
    );

    return (
      data.items?.map((item) => ({
        id: item.id,
        type: item.type ?? "other",
        note: item.note ?? "",
        importance: item.importance ?? "normal",
        readToCleaner: Boolean(item.read_to_cleaner),
      })) ?? []
    );
  } catch {
    return [];
  }
}

async function getClientPreferences(customerId: string) {
  if (customerId === "Not set") {
    return [];
  }

  try {
    const params = new URLSearchParams({
      filter: `client = "${customerId}"`,
      sort: "-importance",
    });

    const data = await pocketBaseRequest<PocketBaseList<PocketBasePreference>>(
      "/api/collections/client_preferences/records",
      { params },
    );

    return (
      data.items?.map((item) => ({
        id: item.id,
        type: item.type ?? "preference",
        note: item.note ?? "",
        importance: item.importance ?? "normal",
        isPersistent: Boolean(item.is_persistent),
      })) ?? []
    );
  } catch {
    return [];
  }
}

export async function getOrder(orderId: string): Promise<OrderDetail | null> {
  const order = (await getOrders()).find((item) => item.orderId === orderId);

  if (!order) {
    return null;
  }

  const [notes, preferences] = await Promise.all([
    getBookingNotes(order.orderId),
    getClientPreferences(order.customerId),
  ]);

  return { order, notes, preferences };
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatAppointment(order: OrderRecord) {
  return `${formatDate(order.start)}, ${formatTime(order.start)} - ${formatTime(
    order.end,
  )}`;
}
