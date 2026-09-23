import AppShell from "@/src/components/AppShell";
import BookingDetail from "@/src/components/BookingDetail";
import { requireCleanerSession } from "@/src/lib/auth";
import { getPublicPocketBaseUrl } from "@/src/lib/pocketbase";

export default async function OrderDetailPage({params}: {params:Promise<{orderId:string}>}) {
  const session = await requireCleanerSession();
  const {orderId} = await params;
  return <AppShell active="orders" title="Booking review" backHref="/orders">
    <BookingDetail key={session.token + orderId} session={{...session, pocketBaseUrl:getPublicPocketBaseUrl()}} orderId={orderId} returnToInbox />
  </AppShell>;
}
