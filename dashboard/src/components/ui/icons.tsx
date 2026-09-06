import type { SVGProps } from "react";

/**
 * SF-Symbols-flavoured line icons. Single stroke weight, rounded caps,
 * 24px grid, `currentColor` so they tint with text.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 11.3 12 4l8.5 7.3" />
      <path d="M5.5 9.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.8" />
      <path d="M9.7 20v-5.2a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1V20" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect height="16" rx="3.5" width="17" x="3.5" y="4.5" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" />
    </Base>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="6" cy="6.5" fill="currentColor" r="0.4" stroke="none" />
    </Base>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.3 7l2 1.2M17.7 15.8l2 1.2M4.3 17l2-1.2M17.7 8.2l2-1.2" />
    </Base>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </Base>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 7V5.5a1.5 1.5 0 0 0-1.5-1.5H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17" />
      <path d="M10 12h10m0 0-3-3m3 3-3 3" />
    </Base>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 4.5h2.2l1.3 3.2-1.7 1.2a11 11 0 0 0 5 5l1.2-1.7 3.2 1.3v2.2a1.8 1.8 0 0 1-1.9 1.8A13.5 13.5 0 0 1 4.7 6.4 1.8 1.8 0 0 1 6.5 4.5Z" />
    </Base>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9.5 5 7 7-7 7" />
    </Base>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m14.5 5-7 7 7 7" />
    </Base>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 9.5 7 7 7-7" />
    </Base>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.3" r="2.3" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 1.8" />
    </Base>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="3.6" />
      <path d="m10.6 10.6 8 8M16 16l1.6-1.6M18.6 18.6l1.4-1.4" />
    </Base>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4M12 3.8c2.4 2.3 3.7 5.2 3.7 8.2S14.4 17.9 12 20.2c-2.4-2.3-3.7-5.2-3.7-8.2S9.6 6.1 12 3.8Z" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 6.5" />
    </Base>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </Base>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5H9l-4 3.5V7A1.5 1.5 0 0 1 6.5 5.5Z" />
    </Base>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z" />
      <path d="M18 14.5c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4Z" />
    </Base>
  );
}
