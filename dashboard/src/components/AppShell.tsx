import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import LogoutForm from "./LogoutForm";
import SessionNotice from "./SessionNotice";
import ThemeToggle from "./ThemeToggle";
import { requireCleanerSession } from "@/src/lib/auth";
import { CalendarIcon, OrdersIcon, SettingsIcon } from "./ui/icons";

export type NavKey = "dashboard" | "calendar" | "orders" | "settings";
export type ShellProfile = { name: string; initials: string; meta: string };
const navItems = [
  {key: "orders", label: "Requests", href: "/", Icon: OrdersIcon},
  {key: "calendar", label: "Schedule", href: "/calendar", Icon: CalendarIcon},
  {key: "settings", label: "Settings", href: "/settings", Icon: SettingsIcon},
];

export function Brand() {
  return <Link href="/" className="brand" aria-label="Yoshida home">
    <Image src="/brand/company-mark.svg" width={36} height={36} alt="" />
    <span>yoshida</span>
  </Link>;
}

function Navigation({active, mobile = false}: {active: NavKey; mobile?: boolean}) {
  return <nav className={mobile ? "mobiletabs" : "workspace-nav"} aria-label={mobile ? "Mobile navigation" : "Main navigation"}>
    {navItems.map(({key, label, href, Icon}) => <Link key={key} href={href}
      aria-current={(active === "dashboard" ? "orders" : active) === key ? "page" : undefined}>
      <Icon className="h-5 w-5" /><span>{label}</span>
    </Link>)}
  </nav>;
}

type FrameProps = { active: NavKey; title: string; subtitle?: ReactNode; actions?: ReactNode; backHref?: string; children: ReactNode };

export function AppFrame({active, title, subtitle, actions, backHref, profile, children}: FrameProps & {profile: ShellProfile}) {
  return <div className="workspace-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="workspace-sidebar">
      <Brand />
      <div className="workspace-label"><strong>My workspace</strong><span>Independent cleaner</span></div>
      <Navigation active={active} />
      <div className="sidebar-bottom">
        <div className="brand-note" aria-hidden="true"><Image src="/brand/company-art.svg" width={178} height={123} alt="" priority /><p>A little help.<br />A lighter day.</p></div>
        <ThemeToggle />
        <div className="profile"><span className="avatar">{profile.initials}</span><div><strong>{profile.name}</strong><small>{profile.meta}</small></div></div>
        <LogoutForm><button type="submit" className="logout-button">Log out</button></LogoutForm>
      </div>
    </aside>
    <div className="workspace-content">
      <header className="mobiletop"><Brand /><ThemeToggle /></header>
      <div className="workspace-topbar"><span>Hello, {profile.name}</span><span aria-hidden="true">›</span><span>{title}</span></div>
      <main id="main" tabIndex={-1}>
        {backHref ? <Link className="back-link" href={backHref}>← Back to requests</Link> : null}
        <header className="pagehead"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{actions}</header>
        {children}
      </main>
    </div>
    <Navigation active={active} mobile />
  </div>;
}

export default async function AppShell(props: FrameProps) {
  const session = await requireCleanerSession();
  const name = session.cleanerName || "Cleaner";
  return <AppFrame {...props} profile={{name, initials:name.split(/\s+/).slice(0,2).map(part => part[0]).join(""), meta:session.cleanerEmail}}>
    <SessionNotice token={session.token} cleanerId={session.cleanerId} />{props.children}
  </AppFrame>;
}
