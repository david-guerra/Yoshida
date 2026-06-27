import Link from "next/link";
import { logoutAction } from "@/src/app/login/actions";
import {
  getCleanerSettings,
  languageLabels,
} from "@/src/lib/cleanerPreferences";
import { requireCleanerSession } from "@/src/lib/auth";

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
  const session = await requireCleanerSession();
  const { cleaner, preferences } = await getCleanerSettings(
    session.cleanerId,
    session.token,
  );
  const cleanerName = cleaner.name || session.cleanerName || "Cleaner";
  const language =
    languageLabels[cleaner.preferred_language] ?? cleaner.preferred_language;
  const locations = preferences.service_locations?.length
    ? preferences.service_locations.slice(0, 2).join(", ")
    : "Service areas";

  return (
    <header className="mx-auto mb-10 max-w-6xl">
      <div className="flex flex-col gap-4 border-b border-[#dde5dc] pb-5 md:flex-row md:items-center md:justify-between">
        <Link
          className="group flex items-center gap-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#9dccac]"
          href="/settings"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#183c2e] shadow-sm transition group-hover:bg-[#244f3b]">
            <span className="text-lg font-bold text-white">
              {getInitials(cleanerName) || "C"}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-[#5d6f62]">Cleaner profile</p>
            <h1 className="text-xl font-semibold tracking-normal text-[#162018]">
              {cleanerName}
            </h1>
            <p className="text-sm text-[#65756a]">
              {locations} - {language} dashboard
            </p>
          </div>
        </Link>

        <nav className="-mx-2 flex items-center gap-1 overflow-x-auto px-2 pb-1 text-sm font-medium text-[#53645a] md:mx-0 md:px-0">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              className={
                tab.id === active
                  ? "shrink-0 rounded-full bg-[#183c2e] px-4 py-2 text-white shadow-sm"
                  : "shrink-0 rounded-full px-4 py-2 transition hover:bg-white hover:text-[#183c2e]"
              }
              href={tab.href}
            >
              {tab.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button
              className="shrink-0 rounded-full px-4 py-2 transition hover:bg-white hover:text-[#183c2e]"
              type="submit"
            >
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
