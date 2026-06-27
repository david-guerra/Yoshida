"use server";

import { revalidatePath } from "next/cache";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  getCleanerSettings,
  parseCsv,
  parseExceptions,
  workingDays,
} from "@/src/lib/cleanerPreferences";
import { pocketBaseRequest } from "@/src/lib/pocketbase";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function values(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((item): item is string => typeof item === "string");
}

function numberValue(formData: FormData, key: string) {
  const raw = Number(value(formData, key));
  return Number.isFinite(raw) ? raw : 0;
}

export async function saveCleanerSettingsAction(formData: FormData) {
  const session = await requireCleanerSession();
  const existing = await getCleanerSettings(session.cleanerId, session.token);
  const selectedDays = values(formData, "workingDays").filter((day) =>
    workingDays.includes(day),
  );
  const serviceLocations = parseCsv(value(formData, "serviceLocations"));
  const preferredServices = values(formData, "preferredServices");

  await pocketBaseRequest(`/api/collections/cleaners/records/${session.cleanerId}`, {
    method: "PATCH",
    auth: "none",
    token: session.token,
    body: {
      name: value(formData, "name"),
      email: value(formData, "email"),
      phone: value(formData, "phone"),
      preferred_language: value(formData, "preferredLanguage"),
      service_areas: serviceLocations,
      skills: preferredServices,
      active: true,
    },
  });

  const preferenceBody = {
    cleaner: session.cleanerId,
    working_days: selectedDays,
    available_start_time: value(formData, "availableStartTime"),
    available_end_time: value(formData, "availableEndTime"),
    minimum_budget: numberValue(formData, "minimumBudget"),
    service_locations: serviceLocations,
    preferred_services: preferredServices,
    business_rules: value(formData, "businessRules"),
    exceptions: parseExceptions(value(formData, "exceptions")),
  };

  if (existing.preferences.id) {
    await pocketBaseRequest(
      `/api/collections/cleaner_preferences/records/${existing.preferences.id}`,
      {
        method: "PATCH",
        auth: "none",
        token: session.token,
        body: preferenceBody,
      },
    );
  } else {
    await pocketBaseRequest("/api/collections/cleaner_preferences/records", {
      method: "POST",
      auth: "none",
      token: session.token,
      body: preferenceBody,
    });
  }

  revalidatePath("/");
  revalidatePath("/settings");
}
