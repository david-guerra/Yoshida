import { NextResponse, type NextRequest } from "next/server";

import { dispatchAgent } from "@/lib/livekit-dispatch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { room } = (await req.json().catch(() => ({}))) as { room?: string };

  if (!room) {
    return NextResponse.json({ error: "Missing required body field: `room`." }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const liveKitUrl = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !liveKitUrl) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set.",
      },
      { status: 500 },
    );
  }

  try {
    await dispatchAgent({ room, liveKitUrl, apiKey, apiSecret });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to dispatch LiveKit agent", err);
    return NextResponse.json({ error: "Failed to dispatch the voice agent." }, { status: 502 });
  }
}
