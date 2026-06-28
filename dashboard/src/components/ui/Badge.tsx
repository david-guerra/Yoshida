import type { ReactNode } from "react";

export type BadgeTone = "blue" | "green" | "orange" | "red" | "gray";

const toneClass: Record<BadgeTone, string> = {
  blue: "bg-accent-soft text-accent",
  green: "bg-green-soft text-green-ink",
  orange: "bg-orange-soft text-orange-ink",
  red: "bg-red-soft text-red-ink",
  gray: "bg-gray-soft text-gray-ink",
};

/** Order tone from the data layer ("amber" | "green" | "red") → badge tone. */
export function statusTone(tone: "amber" | "green" | "red"): BadgeTone {
  if (tone === "green") return "green";
  if (tone === "red") return "red";
  return "orange";
}

export default function Badge({
  children,
  tone = "gray",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
