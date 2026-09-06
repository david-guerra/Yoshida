import type { ReactNode } from "react";

export default function StatTile({
  label,
  value,
  accent = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-group bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary">
        {icon ? <span className="text-tertiary">{icon}</span> : null}
        {label}
      </div>
      <div
        className={`mt-1 text-[28px] font-semibold leading-none tracking-tight ${
          accent ? "text-accent" : "text-label"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
