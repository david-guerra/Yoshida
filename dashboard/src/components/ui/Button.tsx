import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "filled" | "tinted" | "gray" | "plain";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const variantClass: Record<ButtonVariant, string> = {
  filled: "bg-accent text-white shadow-sm hover:bg-accent-hover",
  tinted: "bg-accent-soft text-accent hover:bg-[rgba(0,122,255,0.16)]",
  gray: "bg-fill text-label hover:bg-[rgba(118,118,128,0.2)]",
  plain: "text-accent hover:bg-accent-soft",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-5 text-[15px]",
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
