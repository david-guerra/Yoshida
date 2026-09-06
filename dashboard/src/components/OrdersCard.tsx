import Link from "next/link";
import { ChevronRight } from "@/src/components/ui/icons";

export default function OrdersCard({ type }: { type: "past" | "future" }) {
  const label = type === "past" ? "Past orders" : "Upcoming orders";

  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-group bg-surface px-5 py-4 shadow-card transition hover:bg-fill-2"
      href={`/orders?view=${type}`}
    >
      <span className="text-[16px] font-semibold text-label">{label}</span>
      <ChevronRight className="h-4 w-4 text-tertiary" />
    </Link>
  );
}
