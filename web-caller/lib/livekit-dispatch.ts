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
}: {
  room: string;
  liveKitUrl: string;
  apiKey: string;
  apiSecret: string;
}) {
  const dispatchClient = new AgentDispatchClient(liveKitHttpUrl(liveKitUrl), apiKey, apiSecret);
  const existingDispatches = await dispatchClient.listDispatch(room).catch(() => []);

  for (const dispatch of existingDispatches) {
    if (dispatch.agentName === AGENT_NAME || dispatch.agentName === "") {
      await dispatchClient.deleteDispatch(dispatch.id, room);
    }
  }

  await dispatchClient.createDispatch(room, AGENT_NAME, {
    metadata: JSON.stringify({ source: "web-caller", identity: "caller" }),
  });
}
