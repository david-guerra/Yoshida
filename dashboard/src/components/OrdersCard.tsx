import Link from "next/link";

export default function OrdersCard({ type }: { type: "past" | "future" }) {
  const label = type === "past" ? "Past orders" : "Upcoming orders";

  return (
    <Link
      className="block rounded-2xl border border-[#e1e6dd] bg-white p-6 text-center shadow-sm transition hover:border-[#cbd8ce] hover:bg-[#f8fbf9]"
      href={`/orders?view=${type}`}
    >
      <span className="text-lg font-semibold text-[#25312a]">{label}</span>
    </Link>
  );
}
