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
  budget: string;
  budgetKnown: boolean;
  priceKnown: boolean;
  budgetBelowMinimum: boolean;
  reviewedDetailsAvailable: boolean;
  status: OrderStatus | string;
  tone: OrderTone;
  createdAt: string;
  summary: string;
  cleanerBriefing: string;
  clientNotes: string;
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
  price_known?: boolean;
  budget_known?: boolean;
  budget_below_minimum?: boolean;
  request_snapshot?: {
    caller_phone?: string;
    client?: {
      name?: string;
      email?: string;
      notes?: string;
    };
    address?: {
      street?: string;
      postal_code?: string;
      city?: string;
      country?: string;
      access_notes?: string;
    };
    booking?: {
      start_time?: string;
      timezone?: string;
      service_type?: string;
      estimated_hours?: number | string;
      customer_summary?: string;
      cleaner_briefing?: string;
    };
  };
  expand?: {
    client?: {
      id?: string;
      name?: string;
      phone?: string;
      email?: string;
      notes?: string;
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

  if (normalized.includes("cancel") || normalized.includes("declin")) {
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
  const address = booking.request_snapshot?.address ?? booking.expand?.address;

  if (!address) {
    return "Not set";
  }

  return [address.street, address.postal_code, address.city, address.country]
    .filter(Boolean)
    .join(", ");
}

function hasReviewedDetails(booking: PocketBaseBooking) {
  const snapshot = booking.request_snapshot;
  const address = snapshot?.address;
  const request = snapshot?.booking;
  const hours = Number(request?.estimated_hours);

  return Boolean(
    snapshot?.caller_phone?.trim() &&
      snapshot.client?.name?.trim() &&
      address?.street?.trim() &&
      address.postal_code?.trim() &&
      address.city?.trim() &&
      address.country?.trim() &&
      request?.start_time?.trim() &&
      request.timezone === "Europe/Berlin" &&
      request.service_type?.trim() &&
      Number.isFinite(hours) &&
      hours > 0,
  );
}

export function mapBooking(record: PocketBaseBooking): OrderRecord {
  const start = record.start_time ? new Date(record.start_time) : new Date();
  const end = record.end_time ? new Date(record.end_time) : start;
  const status = normalizeStatus(record.status);
  const snapshot = record.request_snapshot;

  return {
    orderId: record.id,
    customerId: record.expand?.client?.id ?? record.client ?? "Not set",
    customerName:
      snapshot?.client?.name ?? record.expand?.client?.name ?? "Unknown client",
    customerPhone:
      snapshot?.caller_phone ?? record.expand?.client?.phone ?? "Not set",
    customerEmail: snapshot
      ? snapshot.client?.email ?? "Not set"
      : record.expand?.client?.email ?? "Not set",
    start,
    end,
    location: formatAddress(record),
    service: formatServiceType(
      snapshot?.booking?.service_type ?? record.service_type,
    ),
    price: record.price_known ? `${record.price ?? "Unknown"}` : "Unknown",
    budget: record.budget_known ? `${record.budget ?? "Unknown"}` : "Unknown",
    priceKnown: Boolean(record.price_known),
    budgetKnown: Boolean(record.budget_known),
    budgetBelowMinimum: Boolean(record.budget_below_minimum),
    reviewedDetailsAvailable: hasReviewedDetails(record),
    status,
    tone: getTone(status),
    createdAt: record.created_at ?? record.created ?? "Not set",
    summary:
      snapshot?.booking?.customer_summary ??
      record.customer_summary ??
      "No summary saved yet.",
    cleanerBriefing:
      snapshot?.booking?.cleaner_briefing ??
      record.cleaner_briefing ??
      "No cleaner briefing saved yet.",
    clientNotes: snapshot
      ? snapshot.client?.notes ?? "Not set"
      : record.expand?.client?.notes ?? "Not set",
    estimatedHours:
      snapshot?.booking?.estimated_hours !== undefined
        ? `${snapshot.booking.estimated_hours}`
        : record.estimated_hours !== undefined
          ? `${record.estimated_hours}`
          : "Not set",
    accessNotes: snapshot
      ? snapshot.address?.access_notes ?? "Not set"
      : record.expand?.address?.access_notes ?? "Not set",
    category: getCategory(end),
  };
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function formatAppointment(order: OrderRecord) {
  return `${formatDate(order.start)}, ${formatTime(order.start)} - ${formatTime(
    order.end,
  )}`;
}
