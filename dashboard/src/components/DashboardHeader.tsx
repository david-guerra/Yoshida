import Link from "next/link";
import {
  getCleanerSettings,
  languageLabels,
} from "@/src/lib/cleanerPreferences";

type DashboardHeaderProps = {
  active: "dashboard" | "calendar" | "orders" | "settings";
};

const tabs = [
  { href: "/", label: "Dashboard", id: "dashboard" },
  { href: "/calendar", label: "Calendar", id: "calendar" },
  { href: "/orders", label: "Orders", id: "orders" },
  { href: "/settings", label: "Settings", id: "settings" },
] as const;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function DashboardHeader({ active }: DashboardHeaderProps) {
  const { cleaner, preferences } = await getCleanerSettings();
  const language =
    languageLabels[cleaner.preferred_language] ?? cleaner.preferred_language;
  const locations = preferences.service_locations?.length
    ? preferences.service_locations.slice(0, 2).join(", ")
    : "Service areas";

  return (
    <header className="mx-auto mb-8 flex max-w-6xl flex-col gap-5 rounded-lg border border-[#dce6df] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <Link
        className="flex items-center gap-4 rounded-md transition-colors hover:bg-[#f8fbf9]"
        href="/settings"
      >
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#2f6b4f] via-[#7fb07a] to-[#f2c16b] ring-2 ring-white shadow">
          <span className="text-lg font-bold text-white">
            {getInitials(cleaner.name) || "M"}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-[#5d6f62]">Cleaner profile</p>
          <h1 className="text-xl font-semibold tracking-normal text-[#162018]">
            {cleaner.name}
          </h1>
          <p className="text-sm text-[#65756a]">
            {locations} - {language} dashboard
          </p>
        </div>
      </Link>

      <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#53645a]">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            className={
              tab.id === active
                ? "rounded-md bg-[#eaf3ed] px-3 py-2 text-[#244f3b]"
                : "rounded-md px-3 py-2 hover:bg-[#f0f4f1]"
            }
            href={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
