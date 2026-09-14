import { proxyCleanVoiceRequest } from "@/src/lib/cleanVoiceProxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  return proxyCleanVoiceRequest(
    request,
    `/api/cleanvoice/submissions/${encodeURIComponent(submissionId)}`,
    "GET",
  );
}
