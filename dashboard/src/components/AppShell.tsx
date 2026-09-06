import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/src/app/login/actions";
import { requireCleanerSession } from "@/src/lib/auth";
import {
  getCleanerSettings,
  languageLabels,
} from "@/src/lib/cleanerPreferences";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  HomeIcon,
  LogoutIcon,
  OrdersIcon,
  SettingsIcon,
  SparkleIcon,
} from "@/src/components/ui/icons";

export type NavKey = "dashboard" | "calendar" | "orders" | "settings";

export type ShellProfile = {
  name: string;
  initials: string;
  meta: string;
};

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  Icon: (props: { className?: string }) => ReactNode;
};

const navItems: NavItem[] = [
  { key: "dashboard", label: "Home", href: "/", Icon: HomeIcon },
  { key: "calendar", label: "Calendar", href: "/calendar", Icon: CalendarIcon },
  { key: "orders", label: "Orders", href: "/orders", Icon: OrdersIcon },
  { key: "settings", label: "Settings", href: "/settings", Icon: SettingsIcon },
];

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition hover:bg-fill-2"
    >
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-white shadow-sm">
        <SparkleIcon className="h-5 w-5" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-label">
        Yoshida
      </span>
    </Link>
  );
}

function ProfileFooter({ profile }: { profile: ShellProfile }) {
  return (
    <div className="mt-auto">
      <div className="hairline mx-2 mb-2" />
      <Link
        href="/settings"
        className="flex items-center gap-3 rounded-control px-2 py-2 transition hover:bg-fill-2"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-semibold text-label">
          {profile.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-label">
            {profile.name}
          </span>
          <span className="block truncate text-[12px] text-secondary">
            {profile.meta}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-tertiary" />
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className="mt-0.5 flex w-full items-center gap-3 rounded-control px-2 py-2 text-[14px] font-medium text-secondary transition hover:bg-fill-2 hover:text-label"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center">
            <LogoutIcon className="h-5 w-5" />
          </span>
          Log out
        </button>
      </form>
    </div>
  );
}

function Sidebar({
  active,
  profile,
}: {
  active: NavKey;
  profile: ShellProfile;
}) {
  return (
    <aside className="material sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 border-r border-separator px-3 py-4 md:flex">
      <Brand />
      <nav className="mt-4 flex flex-col gap-0.5">
        {navItems.map(({ key, label, href, Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-control px-2.5 py-2 text-[15px] font-medium transition ${
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-label hover:bg-fill-2"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
              {label}
            </Link>
          );
        })}
      </nav>
      <ProfileFooter profile={profile} />
    </aside>
  );
}

function BottomTabBar({ active }: { active: NavKey }) {
  return (
    <nav className="material fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-separator pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden">
      {navItems.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition ${
              isActive ? "text-accent" : "text-secondary"
            }`}
          >
            <Icon className="h-[26px] w-[26px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Pure visual frame: frosted left sidebar on desktop, iOS bottom tab bar on
 * mobile, translucent toolbar above the page. Takes its profile data as a prop
 * so it can render without a session (e.g. in previews).
 */
export function AppFrame({
  active,
  title,
  subtitle,
  actions,
  backHref,
  profile,
  children,
}: {
  active: NavKey;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  profile: ShellProfile;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar active={active} profile={profile} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="material sticky top-0 z-20 flex h-14 min-w-0 items-center gap-2 border-b border-separator px-4 sm:px-6">
          {backHref ? (
            <Link
              href={backHref}
              className="-ml-1.5 flex shrink-0 items-center gap-0.5 rounded-control py-1 pl-1 pr-2 text-[15px] font-medium text-accent transition hover:bg-accent-soft"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </Link>
          ) : null}
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-label">
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8">
          {subtitle ? (
            <p className="mb-6 max-w-2xl text-[15px] leading-6 text-secondary">
              {subtitle}
            </p>
          ) : null}
          {children}
        </main>
      </div>

      <BottomTabBar active={active} />
    </div>
  );
}

/**
 * App frame wired to the cleaner session — fetches the profile for the sidebar
 * and renders {@link AppFrame}.
 */
export default async function AppShell({
  active,
  title,
  subtitle,
  actions,
  backHref,
  children,
}: {
  active: NavKey;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  children: ReactNode;
}) {
  const session = await requireCleanerSession();
  const { cleaner, preferences } = await getCleanerSettings(
    session.cleanerId,
    session.token,
  );
  const name = cleaner.name || session.cleanerName || "Cleaner";
  const language =
    languageLabels[cleaner.preferred_language] ?? cleaner.preferred_language;
  const locations = preferences.service_locations?.length
    ? preferences.service_locations.slice(0, 2).join(", ")
    : "Service areas";

  return (
    <AppFrame
      active={active}
      title={title}
      subtitle={subtitle}
      actions={actions}
      backHref={backHref}
      profile={{
        name,
        initials: getInitials(name),
        meta: `${locations} · ${language}`,
      }}
    >
      {children}
    </AppFrame>
  );
}
