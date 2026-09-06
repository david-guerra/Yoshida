import AppShell from "@/src/components/AppShell";
import { Card } from "@/src/components/ui/Card";
import {
  CheckChip,
  SelectField,
  TextAreaField,
  TextField,
} from "@/src/components/ui/Field";
import { CheckIcon, LogoutIcon, WarningIcon } from "@/src/components/ui/icons";
import { saveCleanerSettingsAction } from "@/src/app/settings/actions";
import { logoutAction } from "@/src/app/login/actions";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  formatCsv,
  formatExceptions,
  getCleanerSettings,
  serviceOptions,
  workingDays,
} from "@/src/lib/cleanerPreferences";
import type { ReactNode } from "react";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold tracking-tight text-label">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[14px] text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireCleanerSession();
  const settings = await getCleanerSettings(session.cleanerId, session.token);
  const { cleaner, preferences } = settings;
  const { error, saved } = await searchParams;

  return (
    <AppShell
      active="settings"
      title="Settings"
      subtitle="Your profile and the rules the voice agent follows before it accepts work."
    >
      {error ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-group bg-red-soft px-4 py-3 text-[14px] font-medium text-red-ink">
          <WarningIcon className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-group bg-green-soft px-4 py-3 text-[14px] font-medium text-green-ink">
          <CheckIcon className="h-5 w-5 shrink-0" />
          Settings saved.
        </div>
      ) : null}

      <form action={saveCleanerSettingsAction} className="space-y-6">
        <SettingsSection title="Basic information">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField defaultValue={cleaner.name} label="Name" name="name" />
            <TextField
              defaultValue={cleaner.email}
              label="Email"
              name="email"
              type="email"
            />
            <TextField
              defaultValue={cleaner.phone}
              label="Phone number"
              name="phone"
              type="tel"
            />
            <SelectField
              defaultValue={cleaner.preferred_language}
              label="Language"
              name="preferredLanguage"
            >
              <option value="en">English</option>
              <option value="de">German</option>
              <option value="tr">Turkish</option>
              <option value="ar">Arabic</option>
              <option value="pl">Polish</option>
              <option value="uk">Ukrainian</option>
              <option value="ru">Russian</option>
              <option value="other">Other</option>
            </SelectField>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Business rules"
          description="When you work and what jobs the agent may accept on your behalf."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2.5 text-[13px] font-semibold text-secondary">
                Working days
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {workingDays.map((day) => (
                  <CheckChip
                    key={day}
                    defaultChecked={preferences.working_days?.includes(day)}
                    label={day}
                    name="workingDays"
                    value={day}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                defaultValue={preferences.available_start_time}
                label="Start time"
                name="availableStartTime"
                type="time"
              />
              <TextField
                defaultValue={preferences.available_end_time}
                label="End time"
                name="availableEndTime"
                type="time"
              />
            </div>

            <TextField
              defaultValue={`${preferences.minimum_budget ?? 0}`}
              label="Minimum budget (€)"
              name="minimumBudget"
              type="number"
            />
            <TextField
              defaultValue={formatCsv(preferences.service_locations)}
              label="Service locations"
              name="serviceLocations"
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Services">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {serviceOptions.map((service) => (
              <CheckChip
                key={service.value}
                defaultChecked={preferences.preferred_services?.includes(
                  service.value,
                )}
                label={service.label}
                name="preferredServices"
                value={service.value}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Exceptions"
          description="Windows you are unavailable, one per line."
        >
          <TextAreaField
            defaultValue={formatExceptions(preferences.exceptions)}
            name="exceptions"
          />
        </SettingsSection>

        <SettingsSection
          title="Agent rules"
          description="Plain-language rules the agent reads before accepting a job."
        >
          <TextAreaField
            defaultValue={preferences.business_rules}
            name="businessRules"
          />
        </SettingsSection>

        <div className="sticky bottom-4 flex justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-semibold text-white shadow-raised transition hover:bg-accent-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            type="submit"
          >
            Save settings
          </button>
        </div>
      </form>

      {/* Account — keeps Log out reachable on mobile, where the sidebar is hidden. */}
      <Card className="mt-6" padded={false}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-label">
              {cleaner.name || session.cleanerName || "Cleaner"}
            </p>
            <p className="truncate text-[13px] text-secondary">
              {cleaner.email || session.cleanerEmail || "Signed in"}
            </p>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-red-soft px-5 text-[15px] font-semibold text-red-ink transition hover:bg-[rgba(255,59,48,0.2)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red/40 sm:w-auto"
            >
              <LogoutIcon className="h-5 w-5" />
              Log out
            </button>
          </form>
        </div>
      </Card>
    </AppShell>
  );
}
