import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "filled" | "tinted" | "gray" | "plain";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-control font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 whitespace-normal text-center";

const variantClass: Record<ButtonVariant, string> = {
  filled: "bg-accent text-accent-ink hover:bg-accent-hover",
  tinted: "bg-accent-soft text-accent hover:bg-[rgba(0,122,255,0.16)]",
  gray: "bg-fill text-label hover:bg-[rgba(118,118,128,0.2)]",
  plain: "text-accent hover:bg-accent-soft",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 py-2 text-[13px]",
  md: "min-h-11 px-4 py-2 text-[15px]",
  lg: "min-h-12 px-5 py-2 text-[15px]",
};

/** Shared class string so `<Link>` and `<button>` look identical. */
export function buttonClass(
  variant: ButtonVariant = "filled",
  size: ButtonSize = "md",
  extra = "",
) {
  return `${base} ${variantClass[variant]} ${sizeClass[size]} ${extra}`;
}

export default function Button({
  variant = "filled",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
