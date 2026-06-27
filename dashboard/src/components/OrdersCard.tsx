import Link from "next/link";

export default function OrdersCard({ type }: { type: "past" | "future" }) {
  const url = type === "past" ? "/past-orders" : "/future-orders";
  return (
    <Link href={url} passHref>
      <div className="bg-white shadow rounded-lg p-6 flex-1 cursor-pointer hover:bg-blue-50 text-center">
        <span className="font-medium text-lg">
          {type === "past" ? "Past Orders" : "Future Orders"}
        </span>
      </div>
    </Link>
  );
}