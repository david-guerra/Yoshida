import Link from "next/link";
import AppShell from "@/src/components/AppShell";
import { buttonClass } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/src/components/ui/Field";
import { WarningIcon } from "@/src/components/ui/icons";
import { createOrderAction } from "@/src/app/orders/actions";

type NewOrderPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const { error } = await searchParams;

  return (
    <AppShell
      active="orders"
      title="New order"
      backHref="/orders"
      subtitle="Add a tentative booking to PocketBase. Nothing is binding until confirmed outside this prototype."
    >
      {error ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-group bg-red-soft px-4 py-3 text-[14px] font-medium text-red-ink">
          <WarningIcon className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      <form action={createOrderAction} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
            Customer & job
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Customer name" name="customerName" required />
            <TextField label="Customer phone" name="customerPhone" required />
            <TextField
              label="Customer email"
              name="customerEmail"
              type="email"
            />
            <SelectField label="Service" name="serviceType" required>
              <option value="regular_cleaning">Regular cleaning</option>
              <option value="deep_cleaning">Deep cleaning</option>
              <option value="move_out">Move-out</option>
              <option value="office">Office</option>
              <option value="other">Other</option>
            </SelectField>
            <TextField
              label="Appointment start"
              name="appointmentStart"
              required
              type="datetime-local"
            />
            <TextField
              label="Estimated hours"
              min="0.5"
              name="estimatedHours"
              required
              step="0.5"
              type="number"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
            Address
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Street" name="street" required />
            <TextField label="Postal code" name="postalCode" />
            <TextField label="City" name="city" required />
            <TextField label="Country" name="country" defaultValue="DE" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-secondary">
            Notes
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextAreaField label="Access notes" name="accessNotes" />
            <TextAreaField label="Client notes" name="clientNotes" />
            <TextAreaField label="Customer summary" name="customerSummary" />
            <TextAreaField label="Cleaner briefing" name="cleanerBriefing" />
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Link className={buttonClass("gray", "md")} href="/orders">
            Cancel
          </Link>
          <button className={buttonClass("filled", "md")} type="submit">
            Create order
          </button>
        </div>
      </form>
    </AppShell>
  );
}
