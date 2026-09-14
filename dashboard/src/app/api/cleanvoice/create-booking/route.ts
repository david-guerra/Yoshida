import { proxyCleanVoiceRequest } from "@/src/lib/cleanVoiceProxy";

export function POST(request: Request) {
  return proxyCleanVoiceRequest(
    request,
    "/api/cleanvoice/create-booking",
    "POST",
  );
}
