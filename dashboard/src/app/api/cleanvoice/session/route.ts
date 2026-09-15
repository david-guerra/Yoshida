import { getCleanerSession } from "@/src/lib/auth";

export async function GET() {
  const session = await getCleanerSession();
  return Response.json(session, { status: session ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
