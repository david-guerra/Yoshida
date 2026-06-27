import { AccessToken } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";

import { dispatchAgent } from "@/lib/livekit-dispatch";

// livekit-server-sdk signs tokens with Node's crypto, so force the Node.js runtime.
export const runtime = "nodejs";

/**
 * GET /api/token?room=<room>&identity=<identity>
 *
 * Mints a short-lived LiveKit access token so a browser participant can join
 * `room` as `identity`, publish their microphone, subscribe to the agent,
 * and explicitly dispatch the named LiveKit Agent worker for the call.
 * Uses the server-only LIVEKIT_API_KEY / LIVEKIT_API_SECRET (never sent to the client).
 */
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const identity = req.nextUrl.searchParams.get("identity");

  if (!room || !identity) {
    return NextResponse.json(
      { error: "Missing required query params: `room` and `identity`." },
      { status: 400 },
    );
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

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "15m",
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true, // publish the caller's mic
    canSubscribe: true, // hear the agent
  });

  try {
    await dispatchAgent({ room, liveKitUrl, apiKey, apiSecret });
  } catch (err) {
    console.error("Failed to dispatch LiveKit agent", err);
    return NextResponse.json({ error: "Failed to dispatch the voice agent." }, { status: 502 });
  }

  const token = await at.toJwt();
  return NextResponse.json({ token });
}
