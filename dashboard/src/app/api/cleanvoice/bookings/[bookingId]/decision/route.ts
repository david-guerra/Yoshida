import { proxyCleanVoiceRequest } from "@/src/lib/cleanVoiceProxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return proxyCleanVoiceRequest(
    request,
    `/api/cleanvoice/bookings/${encodeURIComponent(bookingId)}/decision`,
    "POST",
  );
}
