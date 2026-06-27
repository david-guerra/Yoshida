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

export type PocketBaseBooking = {
  id: string;
  collection?: string;
  collectionName?: string;
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

export function mapBooking(record: PocketBaseBooking): OrderRecord {
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
