import { AgentDispatchClient } from "livekit-server-sdk";

const AGENT_NAME = "client-call-agent";

function liveKitHttpUrl(liveKitUrl: string) {
  const url = new URL(liveKitUrl);

  if (url.protocol === "wss:") {
    url.protocol = "https:";
  }

  if (url.protocol === "ws:") {
    url.protocol = "http:";
  }

  return url.toString();
}

export async function dispatchAgent({
  room,
  liveKitUrl,
  apiKey,
  apiSecret,
  callerPhone,
}: {
  room: string;
  liveKitUrl: string;
  apiKey: string;
  apiSecret: string;
  callerPhone: string;
}) {
  const dispatchClient = new AgentDispatchClient(liveKitHttpUrl(liveKitUrl), apiKey, apiSecret);
  return await dispatchClient.createDispatch(room, AGENT_NAME, {
    metadata: JSON.stringify({
      source: "web-caller",
      identity: "caller",
      caller_phone: callerPhone,
    }),
  });
}
