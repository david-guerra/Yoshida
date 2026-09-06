import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "@/src/components/ui/icons";

/** Elevated rounded card (macOS panel). */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-card bg-surface shadow-card ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * iOS "inset grouped list": an optional uppercase section header, a rounded
 * white container, and a hairline-divided footer note.
 */
export function InsetGroup({
  header,
  footer,
  count,
  children,
  className = "",
}: {
  header?: ReactNode;
  footer?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {header ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
            {header}
          </h2>
          {count !== undefined ? (
            <span className="text-[13px] font-medium text-tertiary">{count}</span>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-group bg-surface shadow-card">
        <div className="divide-y divide-separator">{children}</div>
      </div>
      {footer ? (
        <p className="mt-2 px-1 text-[13px] leading-5 text-secondary">{footer}</p>
      ) : null}
    </section>
  );
}

/**
 * A single grouped-list row. Renders as a link (with trailing chevron) when
 * `href` is set, otherwise as a static row.
 */
export function ListRow({
  href,
  leading,
  title,
  subtitle,
  detail,
  trailing,
  className = "",
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[16px] font-semibold text-label">
          <span className="truncate">{title}</span>
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-[14px] text-secondary">
            {subtitle}
          </div>
        ) : null}
        {detail ? (
          <div className="mt-0.5 truncate text-[13px] text-tertiary">{detail}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2.5">{trailing}</div>
      ) : null}
      {href ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-tertiary" />
      ) : null}
    </>
  );

  const rowClass = `flex w-full items-center gap-3.5 px-4 py-3.5 text-left ${
    href ? "transition hover:bg-fill-2" : ""
  } ${className}`;

  if (href) {
    return (
      <Link className={rowClass} href={href}>
        {inner}
      </Link>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
