import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "@/src/components/ui/icons";

export const controlClass =
  "h-11 w-full rounded-control border border-separator bg-surface px-3.5 text-[15px] text-label outline-none transition placeholder:text-tertiary focus:border-accent focus:ring-4 focus:ring-accent-soft";

const labelClass = "mb-1.5 block text-[13px] font-semibold text-secondary";

export function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = <input className={`${controlClass} ${className}`} {...props} />;
  if (!label) return input;
  return <FieldLabel label={label}>{input}</FieldLabel>;
}

export function TextAreaField({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const textarea = (
    <textarea
      className={`min-h-28 w-full rounded-control border border-separator bg-surface px-3.5 py-3 text-[15px] leading-6 text-label outline-none transition placeholder:text-tertiary focus:border-accent focus:ring-4 focus:ring-accent-soft ${className}`}
      {...props}
    />
  );
  if (!label) return textarea;
  return <FieldLabel label={label}>{textarea}</FieldLabel>;
}

export function SelectField({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const select = (
    <div className="relative">
      <select
        className={`${controlClass} cursor-pointer appearance-none pr-10 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
    </div>
  );
  if (!label) return select;
  return <FieldLabel label={label}>{select}</FieldLabel>;
}

/**
 * A checkbox styled as an iOS selectable chip (used for working days /
 * services). Hidden native input keeps it accessible and form-submittable.
 */
export function CheckChip({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="relative block">
      <input
        className="peer sr-only"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value={value}
      />
      <span className="flex h-11 items-center justify-center rounded-control border border-separator bg-surface px-2 text-center text-[14px] font-semibold text-secondary transition peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft">
        {label}
      </span>
    </label>
  );
}
