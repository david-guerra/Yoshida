import Link from "next/link";
import DashboardHeader from "@/src/components/DashboardHeader";
import { createOrderAction } from "@/src/app/orders/actions";

type NewOrderPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-[#65756a]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-[#dfe7e2] bg-white px-3 text-sm text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]";

const textAreaClass =
  "min-h-24 w-full rounded-md border border-[#dfe7e2] bg-white px-3 py-3 text-sm text-[#162018] outline-none transition focus:border-[#2f6b4f] focus:ring-2 focus:ring-[#d9eadf]";

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-6 text-[#162018] sm:px-8">
      <DashboardHeader active="orders" />

      <section className="mx-auto max-w-6xl rounded-lg border border-[#e3e9e5] bg-white px-5 py-7 shadow-sm sm:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              className="mb-4 inline-block text-sm font-semibold text-[#2f6b4f] hover:text-[#1d3f30]"
              href="/orders"
            >
              {"<"} Back to orders
            </Link>
            <h1 className="text-3xl font-semibold tracking-normal text-[#10231d]">
              New order
            </h1>
            <p className="mt-2 text-sm text-[#65756a]">
              Add a tentative booking to PocketBase.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-md border border-[#f0c7b8] bg-[#fff4ee] px-4 py-3 text-sm font-semibold text-[#9d4327]">
            {error}
          </div>
        ) : null}

        <form action={createOrderAction} className="space-y-7">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer name">
              <input className={inputClass} name="customerName" required />
            </Field>
            <Field label="Customer phone">
              <input className={inputClass} name="customerPhone" required />
            </Field>
            <Field label="Customer email">
              <input className={inputClass} name="customerEmail" type="email" />
            </Field>
            <Field label="Service">
              <select className={inputClass} name="serviceType" required>
                <option value="regular_cleaning">Regular cleaning</option>
                <option value="deep_cleaning">Deep cleaning</option>
                <option value="move_out">Move-out</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Appointment start">
              <input
                className={inputClass}
                name="appointmentStart"
                required
                type="datetime-local"
              />
            </Field>
            <Field label="Estimated hours">
              <input
                className={inputClass}
                min="0.5"
                name="estimatedHours"
                required
                step="0.5"
                type="number"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Street">
              <input className={inputClass} name="street" required />
            </Field>
            <Field label="Postal code">
              <input className={inputClass} name="postalCode" />
            </Field>
            <Field label="City">
              <input className={inputClass} name="city" required />
            </Field>
            <Field label="Country">
              <input className={inputClass} defaultValue="DE" name="country" />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Access notes">
              <textarea className={textAreaClass} name="accessNotes" />
            </Field>
            <Field label="Client notes">
              <textarea className={textAreaClass} name="clientNotes" />
            </Field>
            <Field label="Customer summary">
              <textarea className={textAreaClass} name="customerSummary" />
            </Field>
            <Field label="Cleaner briefing">
              <textarea className={textAreaClass} name="cleanerBriefing" />
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#edf1ee] pt-5">
            <Link
              className="rounded-md border border-[#dfe7e2] bg-white px-4 py-2 text-sm font-semibold text-[#344238] shadow-sm hover:bg-[#f8fbf9]"
              href="/orders"
            >
              Cancel
            </Link>
            <button
              className="rounded-md bg-[#244f3b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1d3f30]"
              type="submit"
            >
              Create order
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
