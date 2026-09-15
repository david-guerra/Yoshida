export type OrderStatus = "Requested" | "Confirmed" | "Declined" | "Unknown status";

export type OrderTone = "amber" | "green" | "red";

export type OrderRecord = {
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  start: Date | null;
  end: Date | null;
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
  category: "upcoming" | "past" | "unknown";
  needsReview: boolean;
  calendarEligible: boolean;
  canConfirm: boolean;
  canDecline: boolean;
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

function validDateParts(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match || match[7] && !Number.isFinite(Date.parse(value!))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(part => Number(part || 0));
  const date = new Date(Date.UTC(year, month-1, day, hour, minute, second));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month-1 &&
    date.getUTCDate() === day && date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function savedDate(value: string | undefined): Date | null {
  if (!validDateParts(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value!)) return null;
  const date = new Date(value!);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeStatus(status: string | undefined): OrderStatus {
  switch (status) {
    case "requested": return "Requested";
    case "confirmed": return "Confirmed";
    case "declined": return "Declined";
    default: return "Unknown status";
  }
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

function validReviewedStart(value: string | undefined) {
  const raw = value?.trim();
  if (!validDateParts(raw)) return false;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.exec(raw!);
  if (!match) return false;
  const local = match[1] + "T" + match[2] + (match[3] || ":00");
  if (match[4] === "Z") return true;
  const localAt = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",
    }).formatToParts(date);
    const part = (name:string) => parts.find(item => item.type === name)!.value;
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  };
  const offsets = match[4] ? [match[4]] : ["+01:00", "+02:00"];
  return offsets.filter(offset => localAt(new Date(local + offset)) === local).length === 1;
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
      validReviewedStart(request?.start_time) &&
      request?.timezone === "Europe/Berlin" &&
      request?.service_type?.trim() &&
      Number.isFinite(hours) &&
      hours > 0,
  );
}

export function mapBooking(record: PocketBaseBooking): OrderRecord {
  const start = savedDate(record.start_time);
  const end = savedDate(record.end_time);
  const validSchedule = Boolean(start && end && end > start);
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
    tone: status === "Confirmed" ? "green" : status === "Declined" ? "red" : "amber",
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
    category: !validSchedule ? "unknown" : end!.getTime() < Date.now() ? "past" : "upcoming",
    needsReview: record.status === "requested",
    calendarEligible: validSchedule && (record.status === "requested" || record.status === "confirmed"),
    canConfirm: record.status === "requested" && validSchedule && start!.getTime() > Date.now() && hasReviewedDetails(record),
    canDecline: record.status === "requested",
  };
}

export function formatDate(date: Date | null) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function formatTime(date: Date | null) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function formatAppointment(order: OrderRecord) {
  if (!order.start || !order.end || order.end <= order.start) return "Unknown";
  return `${formatDate(order.start)}, ${formatTime(order.start)} - ${formatTime(
    order.end,
  )}`;
}
