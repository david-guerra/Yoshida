import Link from "next/link";

export type Segment = {
  label: string;
  href: string;
  active: boolean;
};

/**
 * iOS segmented control rendered as navigable links. The active segment lifts
 * onto a white "thumb"; the track is a recessed fill.
 */
export default function SegmentedControl({
  segments,
  className = "",
}: {
  segments: Segment[];
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-control bg-fill p-1 ${className}`}
    >
      {segments.map((segment) => (
        <Link
          aria-current={segment.active ? "page" : undefined}
          className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition ${
            segment.active
              ? "bg-surface text-label shadow-sm"
              : "text-secondary hover:text-label"
          }`}
          href={segment.href}
          key={segment.href}
        >
          {segment.label}
        </Link>
      ))}
    </div>
  );
}
