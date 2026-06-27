import { pocketBaseRequest } from "@/src/lib/pocketbase";

export const workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const serviceOptions = [
  { label: "Regular cleaning", value: "regular_cleaning" },
  { label: "Deep cleaning", value: "deep_cleaning" },
  { label: "Move-out", value: "move_out" },
  { label: "Office", value: "office" },
  { label: "Other", value: "other" },
];

type PocketBaseList<T> = {
  items?: T[];
};

type CleanerRecord = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  preferred_language?: string;
  active?: boolean;
  skills?: string[];
  service_areas?: string[];
  notes?: string;
};

export type CleanerProfile = Required<
  Pick<CleanerRecord, "id" | "name" | "phone" | "email" | "preferred_language">
> & {
  service_areas: string[];
  skills: string[];
};

export type CleanerPreferenceRecord = {
  id: string;
  cleaner: string;
  working_days?: string[];
  available_start_time?: string;
  available_end_time?: string;
  service_locations?: string[];
  preferred_services?: string[];
  minimum_budget?: number;
  business_rules?: string;
  exceptions?: CleanerException[];
};

export type CleanerException = {
  date: string;
  from: string;
  until: string;
  reason: string;
};

export type CleanerSettings = {
  cleaner: CleanerProfile;
  preferences: CleanerPreferenceRecord;
};

export const languageLabels: Record<string, string> = {
  ar: "Arabic",
  de: "German",
  en: "English",
  other: "Other",
  pl: "Polish",
  ru: "Russian",
  tr: "Turkish",
  uk: "Ukrainian",
};

function emptyPreference(cleanerId: string): CleanerPreferenceRecord {
  return {
    id: "",
    cleaner: cleanerId,
    working_days: [],
    available_start_time: "",
    available_end_time: "",
    service_locations: [],
    preferred_services: [],
    minimum_budget: 0,
    business_rules: "",
    exceptions: [],
  };
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeExceptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const exception = item as Record<string, unknown>;

      return {
        date: typeof exception.date === "string" ? exception.date : "",
        from: typeof exception.from === "string" ? exception.from : "",
        until: typeof exception.until === "string" ? exception.until : "",
        reason:
          typeof exception.reason === "string" ? exception.reason : "Unavailable",
      };
    })
    .filter((item): item is CleanerException => Boolean(item?.date));
}

function normalizePreference(
  cleanerId: string,
  preference: Partial<CleanerPreferenceRecord> | undefined,
) {
  return {
    ...emptyPreference(cleanerId),
    ...preference,
    cleaner: preference?.cleaner ?? cleanerId,
    working_days: normalizeStringArray(preference?.working_days),
    service_locations: normalizeStringArray(preference?.service_locations),
    preferred_services: normalizeStringArray(preference?.preferred_services),
    exceptions: normalizeExceptions(preference?.exceptions),
  };
}

export function formatCsv(values: string[] | undefined) {
  return values?.join(", ") ?? "";
}

export function formatExceptions(values: CleanerException[] | undefined) {
  return (
    values
      ?.map((item) =>
        [item.date, `${item.from}-${item.until}`, item.reason].filter(Boolean).join(", "),
      )
      .join("\n") ?? ""
  );
}

export function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseExceptions(value: string): CleanerException[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date = "", timeRange = "", ...reasonParts] = line
        .split(",")
        .map((part) => part.trim());
      const [from = "", until = ""] = timeRange
        .split("-")
        .map((part) => part.trim());

      return {
        date,
        from,
        until,
        reason: reasonParts.join(", ") || "Unavailable",
      };
    })
    .filter((item) => item.date && item.from && item.until);
}

function normalizeCleaner(cleaner: CleanerRecord): CleanerProfile {
  return {
    id: cleaner.id,
    name: cleaner.name ?? "",
    phone: cleaner.phone ?? "",
    email: cleaner.email ?? "",
    preferred_language: cleaner.preferred_language ?? "en",
    service_areas: normalizeStringArray(cleaner.service_areas),
    skills: normalizeStringArray(cleaner.skills),
  };
}

export async function getCleanerProfile(cleanerId: string, token?: string) {
  const cleaner = await pocketBaseRequest<CleanerRecord>(
    `/api/collections/cleaners/records/${cleanerId}`,
    { auth: token ? "none" : "required", token },
  );

  return normalizeCleaner(cleaner);
}

export async function getCleanerSettings(
  cleanerId: string,
  token?: string,
): Promise<CleanerSettings> {
  const cleaner = await getCleanerProfile(cleanerId, token);

  const params = new URLSearchParams({
    filter: `cleaner = "${cleanerId}"`,
    perPage: "1",
  });

  const preferenceData = await pocketBaseRequest<
    PocketBaseList<CleanerPreferenceRecord>
  >("/api/collections/cleaner_preferences/records", {
    auth: token ? "none" : "required",
    params,
    token,
  });

  return {
    cleaner,
    preferences: normalizePreference(cleanerId, preferenceData.items?.[0]),
  };
}
