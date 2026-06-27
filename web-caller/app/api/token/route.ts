import { AccessToken } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";

// livekit-server-sdk signs tokens with Node's crypto, so force the Node.js runtime.
export const runtime = "nodejs";

/**
 * GET /api/token?room=<room>&identity=<identity>
 *
 * Mints a short-lived LiveKit access token so a browser participant can join
 * `room` as `identity`, publish their microphone, and subscribe to the agent.
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

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set." },
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

  const token = await at.toJwt();
  return NextResponse.json({ token });
}
