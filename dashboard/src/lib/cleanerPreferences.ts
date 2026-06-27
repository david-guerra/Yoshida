import { pocketBaseRequest } from "@/src/lib/pocketbase";

export const CLEANER_ID =
  process.env.NEXT_PUBLIC_CLEANER_ID ??
  process.env.CLEANER_ID ??
  "4bv09jvfeljswjj";

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

const defaultPreferences: CleanerPreferenceRecord = {
  id: "",
  cleaner: CLEANER_ID,
  working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  available_start_time: "08:00",
  available_end_time: "17:00",
  service_locations: ["Mitte", "Kreuzberg", "Neukolln", "Prenzlauer Berg"],
  preferred_services: ["regular_cleaning", "deep_cleaning", "move_out"],
  minimum_budget: 80,
  business_rules:
    "Only accept jobs in listed service locations, during working days and hours, above minimum budget, and matching preferred services. If anything is unclear or outside these rules, mark the booking as requested for cleaner approval.",
  exceptions: [
    {
      date: "2026-07-24",
      from: "13:00",
      until: "18:00",
      reason: "Unavailable",
    },
  ],
};

const defaultCleaner: CleanerProfile = {
  id: CLEANER_ID,
  name: "Maria",
  phone: "+49 170 0000001",
  email: "maria@example.com",
  preferred_language: "en",
  service_areas: defaultPreferences.service_locations ?? [],
  skills: defaultPreferences.preferred_services ?? [],
};

const defaultSettings: CleanerSettings = {
  cleaner: defaultCleaner,
  preferences: defaultPreferences,
};

function normalizeStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function normalizeExceptions(value: unknown) {
  if (!Array.isArray(value)) {
    return defaultPreferences.exceptions ?? [];
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
  preference: Partial<CleanerPreferenceRecord> | undefined,
) {
  return {
    ...defaultPreferences,
    ...preference,
    cleaner: preference?.cleaner ?? CLEANER_ID,
    working_days: normalizeStringArray(
      preference?.working_days,
      defaultPreferences.working_days ?? [],
    ),
    service_locations: normalizeStringArray(
      preference?.service_locations,
      defaultPreferences.service_locations ?? [],
    ),
    preferred_services: normalizeStringArray(
      preference?.preferred_services,
      defaultPreferences.preferred_services ?? [],
    ),
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
    name: cleaner.name ?? "Maria",
    phone: cleaner.phone ?? "",
    email: cleaner.email ?? "",
    preferred_language: cleaner.preferred_language ?? "en",
    service_areas: normalizeStringArray(cleaner.service_areas, []),
    skills: normalizeStringArray(cleaner.skills, []),
  };
}

export async function getCleanerProfile() {
  try {
    const cleaner = await pocketBaseRequest<CleanerRecord>(
      `/api/collections/cleaners/records/${CLEANER_ID}`,
      { auth: "required" },
    );

    return normalizeCleaner(cleaner);
  } catch {
    return defaultCleaner;
  }
}

export async function getCleanerSettings(): Promise<CleanerSettings> {
  try {
    const cleaner = await getCleanerProfile();

    const params = new URLSearchParams({
      filter: `cleaner = "${CLEANER_ID}"`,
      perPage: "1",
    });

    const preferenceData = await pocketBaseRequest<
      PocketBaseList<CleanerPreferenceRecord>
    >("/api/collections/cleaner_preferences/records", {
      auth: "required",
      params,
    });

    const preferences = normalizePreference(preferenceData.items?.[0]);

    return {
      cleaner,
      preferences,
    };
  } catch {
    return defaultSettings;
  }
}
