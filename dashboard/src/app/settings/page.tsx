import DashboardHeader from "@/src/components/DashboardHeader";
import { saveCleanerSettingsAction } from "@/src/app/settings/actions";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  formatCsv,
  formatExceptions,
  getCleanerSettings,
  serviceOptions,
  workingDays,
} from "@/src/lib/cleanerPreferences";
import type { ReactNode } from "react";

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#344238]">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-md border border-[#dfe7e2] bg-white px-3 text-sm text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

function TextArea({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#344238]">
        {label}
      </span>
      <textarea
        className="min-h-28 w-full rounded-md border border-[#dfe7e2] bg-white px-3 py-3 text-sm leading-6 text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]"
        defaultValue={defaultValue}
        name={name}
      />
    </label>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e1e6dd] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-5 text-xl font-semibold text-[#25312a]">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const session = await requireCleanerSession();
  const settings = await getCleanerSettings(session.cleanerId, session.token);
  const { cleaner, preferences } = settings;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-5 text-[#162018] sm:px-8">
      <DashboardHeader active="settings" />

      <form action={saveCleanerSettingsAction} className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-semibold text-[#3d6d58]">
            Business profile
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal text-[#10231d]">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[#65756a]">
            Profile details and rules the voice agent uses before accepting work.
          </p>
        </div>

        <SettingsSection title="Basic Information">
          <div className="grid gap-4 md:grid-cols-2">
            <Field defaultValue={cleaner.name} label="Name" name="name" />
            <Field
              defaultValue={cleaner.email}
              label="Email"
              name="email"
              type="email"
            />
            <Field
              defaultValue={cleaner.phone}
              label="Phone number"
              name="phone"
              type="tel"
            />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#344238]">
                Language
              </span>
              <select
                className="h-11 w-full rounded-md border border-[#dfe7e2] bg-white px-3 text-sm text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]"
                defaultValue={cleaner.preferred_language}
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
              </select>
            </label>
          </div>
        </SettingsSection>

        <SettingsSection title="Business Rules">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-[#344238]">
                Working days
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {workingDays.map((day) => (
                  <label
                    className="relative block h-11"
                    key={day}
                  >
                    <input
                      className="peer sr-only"
                      defaultChecked={preferences.working_days?.includes(day)}
                      name="workingDays"
                      type="checkbox"
                      value={day}
                    />
                    <span className="flex h-full items-center justify-center rounded-md border border-[#dfe7e2] bg-[#fbfcfb] text-sm font-semibold text-[#344238] peer-checked:border-[#244f3b] peer-checked:bg-[#eaf3ed] peer-checked:text-[#244f3b]">
                      {day}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={preferences.available_start_time}
                label="Start time"
                name="availableStartTime"
                type="time"
              />
              <Field
                defaultValue={preferences.available_end_time}
                label="End time"
                name="availableEndTime"
                type="time"
              />
            </div>

            <Field
              defaultValue={`${preferences.minimum_budget ?? 0}`}
              label="Minimum budget"
              name="minimumBudget"
              type="number"
            />
            <Field
              defaultValue={formatCsv(preferences.service_locations)}
              label="Service location"
              name="serviceLocations"
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Services">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {serviceOptions.map((service) => (
              <label className="relative block h-11" key={service.value}>
                <input
                  className="peer sr-only"
                  defaultChecked={preferences.preferred_services?.includes(
                    service.value,
                  )}
                  name="preferredServices"
                  type="checkbox"
                  value={service.value}
                />
                <span className="flex h-full items-center justify-center rounded-md border border-[#dfe7e2] bg-[#fbfcfb] px-2 text-center text-sm font-semibold text-[#344238] peer-checked:border-[#244f3b] peer-checked:bg-[#eaf3ed] peer-checked:text-[#244f3b]">
                  {service.label}
                </span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Exceptions">
          <TextArea
            defaultValue={formatExceptions(preferences.exceptions)}
            label="Unavailable windows"
            name="exceptions"
          />
        </SettingsSection>

        <SettingsSection title="Agent Rules">
          <TextArea
            defaultValue={preferences.business_rules}
            label="Business rules"
            name="businessRules"
          />
        </SettingsSection>

        <div className="flex justify-end">
          <button
            className="rounded-full bg-[#244f3b] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3f30]"
            type="submit"
          >
            Save settings
          </button>
        </div>
      </form>
    </main>
  );
}
