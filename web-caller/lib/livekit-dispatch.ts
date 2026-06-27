import { AgentDispatchClient, RoomServiceClient, type AgentDispatch } from "livekit-server-sdk";

const AGENT_NAME = "client-call-agent";
const LIVEKIT_AGENT_PARTICIPANT_KIND = 4;

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
  const liveKitHttpEndpoint = liveKitHttpUrl(liveKitUrl);
  const roomClient = new RoomServiceClient(liveKitHttpEndpoint, apiKey, apiSecret);
  const activeParticipants = await roomClient.listParticipants(room).catch(() => []);

  const activeAgent = activeParticipants.find((participant) => {
    const searchable = `${participant.identity} ${participant.name}`.toLowerCase();

    return (
      participant.kind === LIVEKIT_AGENT_PARTICIPANT_KIND ||
      searchable.includes("agent") ||
      searchable.includes("assistant") ||
      searchable.includes(AGENT_NAME)
    );
  });

  if (activeAgent) {
    return { status: "already-present", participantIdentity: activeAgent.identity };
  }

  const dispatchClient = new AgentDispatchClient(liveKitHttpEndpoint, apiKey, apiSecret);
  const staleDispatches = await dispatchClient.listDispatch(room).catch(() => []);
  await Promise.all(
    staleDispatches
      .filter((dispatch) => isCleanVoiceDispatch(dispatch))
      .map((dispatch) => dispatchClient.deleteDispatch(dispatch.id, room).catch(() => undefined)),
  );

  return await dispatchClient.createDispatch(room, AGENT_NAME, {
    metadata: JSON.stringify({
      source: "web-caller",
      identity: "caller",
      caller_phone: callerPhone,
    }),
  });
}

function isCleanVoiceDispatch(dispatch: AgentDispatch) {
  return dispatch.agentName === AGENT_NAME || dispatch.agentName === "";
}
