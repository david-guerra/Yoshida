"use client";

import "@livekit/components-styles";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, ParticipantKind, type Participant } from "livekit-client";
import { useCallback, useState } from "react";

// The agent and the cleaner view join this same room. Project convention
// (see ../CLAUDE.md): hardcode "demo-call" everywhere for the demo.
const ROOM_NAME = "demo-call";
const CALLER_IDENTITY = "caller";

type CallState = "ready" | "connecting" | "live" | "ended";

const CALL_STATE_LABELS: Record<CallState, string> = {
  ready: "Ready",
  connecting: "Connecting...",
  live: "Live",
  ended: "Ended",
};

async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not available in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  stream.getTracks().forEach((track) => track.stop());
}

function formatCallError(err: unknown) {
  if (
    err instanceof DOMException &&
    ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(err.name)
  ) {
    return "Microphone permission is blocked. Allow microphone access for localhost:3000, then start the call again.";
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Failed to start the call.";
}

export default function Home() {
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>("ready");
  const [error, setError] = useState<string | null>(null);

  const startCall = useCallback(async () => {
    setError(null);

    if (!serverUrl) {
      setError("NEXT_PUBLIC_LIVEKIT_URL is not set. Add it to web-caller/.env.local.");
      return;
    }

    setCallState("connecting");
    try {
      await ensureMicrophonePermission();

      const res = await fetch(
        `/api/token?room=${encodeURIComponent(ROOM_NAME)}&identity=${encodeURIComponent(
          CALLER_IDENTITY,
        )}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Token request failed (${res.status})`);
      }
      const data = (await res.json()) as { token: string };
      setToken(data.token);
    } catch (err) {
      setError(formatCallError(err));
      setCallState("ready");
    }
  }, [serverUrl]);

  const endCall = useCallback(() => {
    setToken(null);
    setCallState("ended");
  }, []);

  const dispatchAgentAfterConnect = useCallback(async () => {
    const res = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: ROOM_NAME }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Agent dispatch failed (${res.status})`);
    }
  }, []);

  const handleConnected = useCallback(() => {
    setCallState("live");
    dispatchAgentAfterConnect().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to dispatch the voice agent.");
    });
  }, [dispatchAgentAfterConnect]);

  const handleLiveKitError = useCallback((err: Error) => {
    setError(formatCallError(err));
    setToken(null);
    setCallState("ready");
  }, []);

  const handleMediaDeviceFailure = useCallback((_failure?: unknown, kind?: MediaDeviceKind) => {
    const device = kind === "audioinput" ? "microphone" : "media device";
    setError(
      `Microphone permission is blocked. Check ${device} permissions for localhost:3000, then start the call again.`,
    );
    setToken(null);
    setCallState("ready");
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f7ef] p-6 text-zinc-950">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-950/10 bg-[#fffdf8] p-6 shadow-2xl shadow-zinc-950/10">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            CleanVoice caller
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Cleaning service</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            You&apos;re the German-speaking client. Start the call and talk to the AI front desk.
          </p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-zinc-950/10 bg-zinc-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Room</p>
            <p className="mt-1 font-semibold">{ROOM_NAME}</p>
          </div>
          <div className="rounded-2xl border border-zinc-950/10 bg-zinc-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Call</p>
            <p className="mt-1 font-semibold">{CALL_STATE_LABELS[callState]}</p>
          </div>
        </div>

        {!token ? (
          <button
            onClick={startCall}
            disabled={callState === "connecting"}
            className="flex h-16 w-full items-center justify-center rounded-full bg-emerald-600 px-6 text-base font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {callState === "connecting" ? "Connecting..." : "Start call"}
          </button>
        ) : (
          <LiveKitRoom
            serverUrl={serverUrl!}
            token={token}
            connect
            audio
            video={false}
            onConnected={handleConnected}
            onDisconnected={endCall}
            onError={handleLiveKitError}
            onMediaDeviceFailure={handleMediaDeviceFailure}
          >
            <RoomAudioRenderer />
            <CallSession onEnd={endCall} />
          </LiveKitRoom>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </main>
  );
}

const STATE_LABELS: Partial<Record<ConnectionState, { label: string; dot: string }>> = {
  [ConnectionState.Connecting]: { label: "Connecting...", dot: "bg-amber-400 animate-pulse" },
  [ConnectionState.Connected]: { label: "Connected", dot: "bg-emerald-400" },
  [ConnectionState.Reconnecting]: { label: "Reconnecting...", dot: "bg-amber-400 animate-pulse" },
  [ConnectionState.Disconnected]: { label: "Disconnected", dot: "bg-zinc-400" },
};

function isLikelyAgentParticipant(participant: Participant) {
  const searchable = `${participant.identity} ${participant.name ?? ""}`.toLowerCase();

  return (
    participant.kind === ParticipantKind.AGENT ||
    searchable.includes("agent") ||
    searchable.includes("assistant") ||
    searchable.includes("client-call-agent")
  );
}

function CallSession({ onEnd }: { onEnd: () => void }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [muted, setMuted] = useState(false);

  const agentParticipant =
    remoteParticipants.find(isLikelyAgentParticipant) ??
    (remoteParticipants.length === 1 ? remoteParticipants[0] : undefined);
  const agentInRoom = Boolean(agentParticipant);

  const toggleMute = useCallback(async () => {
    const nextMuted = !muted;
    await localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }, [muted, localParticipant]);

  const disconnect = useCallback(async () => {
    await room.disconnect();
    onEnd();
  }, [onEnd, room]);

  const status = STATE_LABELS[connectionState] ?? { label: connectionState, dot: "bg-zinc-400" };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
            <span className="font-semibold">{status.label}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-300">Caller mic is {muted ? "muted" : "open"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-950/10 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                agentInRoom ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-semibold">{agentInRoom ? "Agent joined" : "Agent waiting"}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Participant identity: {CALLER_IDENTITY}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 px-4 py-3">
          <SpeakingIndicator
            participant={localParticipant}
            label="You"
            activeLabel="Speaking"
            idleLabel={muted ? "Muted" : "Listening"}
            activeClassName="bg-emerald-500 shadow-emerald-500/40"
            idleClassName={muted ? "bg-zinc-400" : "bg-emerald-200"}
          />
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-50 px-4 py-3">
          {agentParticipant ? (
            <SpeakingIndicator
              participant={agentParticipant}
              label="Agent"
              activeLabel="Speaking"
              idleLabel="Listening"
              activeClassName="bg-sky-500 shadow-sky-500/40"
              idleClassName="bg-sky-200"
            />
          ) : (
            <IdleSpeakerIndicator label="Agent" stateLabel="Waiting" dotClassName="bg-zinc-300" />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={toggleMute}
          className={`h-14 flex-1 rounded-full px-5 text-sm font-semibold transition focus:outline-none focus:ring-4 ${
            muted
              ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 focus:ring-amber-500/20"
              : "bg-zinc-950 text-white hover:bg-zinc-800 focus:ring-zinc-950/20"
          }`}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={disconnect}
          className="h-14 flex-1 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus:ring-4 focus:ring-red-500/20"
        >
          End call
        </button>
      </div>
    </div>
  );
}

function SpeakingIndicator({
  participant,
  label,
  activeLabel,
  idleLabel,
  activeClassName,
  idleClassName,
}: {
  participant: Participant;
  label: string;
  activeLabel: string;
  idleLabel: string;
  activeClassName: string;
  idleClassName: string;
}) {
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-3 w-3 rounded-full shadow-lg transition ${
          isSpeaking ? `${activeClassName} animate-pulse` : idleClassName
        }`}
      />
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-zinc-500">{isSpeaking ? activeLabel : idleLabel}</p>
      </div>
    </div>
  );
}

function IdleSpeakerIndicator({
  label,
  stateLabel,
  dotClassName,
}: {
  label: string;
  stateLabel: string;
  dotClassName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${dotClassName}`} />
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-zinc-500">{stateLabel}</p>
      </div>
    </div>
  );
}
