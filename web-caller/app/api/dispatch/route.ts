import { NextResponse, type NextRequest } from "next/server";

import { dispatchAgent } from "@/lib/livekit-dispatch";

export const runtime = "nodejs";

const DEFAULT_SIMULATED_CALLER_PHONE = "+12025550102";

function simulatedCallerPhone() {
  return process.env.SIMULATED_CALLER_PHONE?.trim() || DEFAULT_SIMULATED_CALLER_PHONE;
}

export async function POST(req: NextRequest) {
  const { room } = (await req.json().catch(() => ({}))) as { room?: string };

  if (!room) {
    return NextResponse.json({ error: "Missing required body field: `room`." }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const liveKitUrl = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const callerPhone = simulatedCallerPhone();

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
    await dispatchAgent({ room, liveKitUrl, apiKey, apiSecret, callerPhone });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to dispatch LiveKit agent", err);
    return NextResponse.json({ error: "Failed to dispatch the voice agent." }, { status: 502 });
  }
}
