"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pocketBaseRequest } from "@/src/lib/pocketbase";

const CLEANER_ID =
  process.env.NEXT_PUBLIC_CLEANER_ID ??
  process.env.CLEANER_ID ??
  "4bv09jvfeljswjj";

type CreatedRecord = {
  id: string;
};

function requiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseEstimatedHours(formData: FormData) {
  const rawValue = requiredValue(formData, "estimatedHours");
  const hours = Number(rawValue);

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("estimatedHours must be a positive number.");
  }

  return hours;
}

function toPocketBaseDate(date: Date) {
  return date.toISOString().replace("T", " ");
}

export async function createOrderAction(formData: FormData) {
  let bookingId: string;

  try {
    const customerName = requiredValue(formData, "customerName");
    const customerPhone = requiredValue(formData, "customerPhone");
    const street = requiredValue(formData, "street");
    const city = requiredValue(formData, "city");
    const serviceType = requiredValue(formData, "serviceType");
    const appointmentStart = requiredValue(formData, "appointmentStart");
    const estimatedHours = parseEstimatedHours(formData);

    const startTime = new Date(appointmentStart);
    const endTime = new Date(startTime.getTime() + estimatedHours * 60 * 60 * 1000);

    if (Number.isNaN(startTime.getTime())) {
      throw new Error("appointmentStart must be a valid date/time.");
    }

    const client = await pocketBaseRequest<CreatedRecord>(
      "/api/collections/clients/records",
      {
        method: "POST",
        auth: "required",
        body: {
          name: customerName,
          phone: customerPhone,
          email: optionalValue(formData, "customerEmail"),
          preferred_language: "de",
          status: "new",
          notes: optionalValue(formData, "clientNotes"),
        },
      },
    );

    const address = await pocketBaseRequest<CreatedRecord>(
      "/api/collections/addresses/records",
      {
        method: "POST",
        auth: "required",
        body: {
          client: client.id,
          label: "Booking address",
          is_default: true,
          street,
          postal_code: optionalValue(formData, "postalCode"),
          city,
          country: optionalValue(formData, "country") || "DE",
          access_notes: optionalValue(formData, "accessNotes"),
        },
      },
    );

    const booking = await pocketBaseRequest<CreatedRecord>(
      "/api/collections/bookings/records",
      {
        method: "POST",
        auth: "required",
        body: {
          client: client.id,
          address: address.id,
          cleaner: CLEANER_ID,
          start_time: toPocketBaseDate(startTime),
          end_time: toPocketBaseDate(endTime),
          status: "requested",
          service_type: serviceType,
          estimated_hours: estimatedHours,
          customer_summary: optionalValue(formData, "customerSummary"),
          cleaner_briefing: optionalValue(formData, "cleanerBriefing"),
          calendar_sent: false,
          source: "dashboard",
        },
      },
    );

    bookingId = booking.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create order.";
    redirect(`/orders/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  redirect(`/orders/${bookingId}`);
}
