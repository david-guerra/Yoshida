"use server";

import { revalidatePath } from "next/cache";
import {
  CLEANER_ID,
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
  const existing = await getCleanerSettings();
  const selectedDays = values(formData, "workingDays").filter((day) =>
    workingDays.includes(day),
  );
  const serviceLocations = parseCsv(value(formData, "serviceLocations"));
  const preferredServices = values(formData, "preferredServices");

  await pocketBaseRequest(`/api/collections/cleaners/records/${CLEANER_ID}`, {
    method: "PATCH",
    auth: "required",
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
    cleaner: CLEANER_ID,
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
        auth: "required",
        body: preferenceBody,
      },
    );
  } else {
    await pocketBaseRequest("/api/collections/cleaner_preferences/records", {
      method: "POST",
      auth: "required",
      body: preferenceBody,
    });
  }

  revalidatePath("/settings");
}

