"use client";

import "@livekit/components-styles";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useCallback, useState } from "react";

// The agent and the cleaner view join this same room. Project convention
// (see ../CLAUDE.md): hardcode "demo-call" everywhere for the demo.
const ROOM_NAME = "demo-call";

export default function Home() {
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCall = useCallback(async () => {
    setError(null);

    if (!serverUrl) {
      setError("NEXT_PUBLIC_LIVEKIT_URL is not set — add it to web-caller/.env.local.");
      return;
    }

    setConnecting(true);
    try {
      const identity = `caller-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(
        `/api/token?room=${encodeURIComponent(ROOM_NAME)}&identity=${encodeURIComponent(identity)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Token request failed (${res.status})`);
      }
      const data = (await res.json()) as { token: string };
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the call.");
      setConnecting(false);
    }
  }, [serverUrl]);

  const endCall = useCallback(() => {
    setToken(null);
    setConnecting(false);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <header className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400">
            Sparkle Cleaning Co.
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Call the cleaning service</h1>
          <p className="mt-2 text-sm text-slate-400">
            You&apos;re the caller. Tap to ring the AI receptionist and talk it through.
          </p>
        </header>

        {!token ? (
          <button
            onClick={startCall}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "📞 Start call"}
          </button>
        ) : (
          <LiveKitRoom
            serverUrl={serverUrl!}
            token={token}
            connect
            audio
            video={false}
            onConnected={() => setConnecting(false)}
            onDisconnected={endCall}
            onError={(e) => setError(e.message)}
          >
            {/* Plays the agent's audio track through the browser. */}
            <RoomAudioRenderer />
            <CallSession onEnd={endCall} />
          </LiveKitRoom>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
        )}
      </div>
    </main>
  );
}

const STATE_LABELS: Partial<Record<ConnectionState, { label: string; dot: string }>> = {
  [ConnectionState.Connecting]: { label: "Connecting…", dot: "bg-amber-400 animate-pulse" },
  [ConnectionState.Connected]: { label: "Connected", dot: "bg-emerald-400" },
  [ConnectionState.Reconnecting]: { label: "Reconnecting…", dot: "bg-amber-400 animate-pulse" },
  [ConnectionState.Disconnected]: { label: "Disconnected", dot: "bg-slate-500" },
};

function CallSession({ onEnd }: { onEnd: () => void }) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [muted, setMuted] = useState(false);

  const toggleMute = useCallback(async () => {
    const nextMuted = !muted;
    await localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }, [muted, localParticipant]);

  const status = STATE_LABELS[connectionState] ?? { label: connectionState, dot: "bg-slate-500" };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-2 rounded-full bg-black/20 py-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
        <span className="text-slate-200">{status.label}</span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={toggleMute}
          className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold transition ${
            muted
              ? "bg-amber-500/90 text-white hover:bg-amber-400"
              : "bg-white/10 text-slate-100 hover:bg-white/20"
          }`}
        >
          {muted ? "🔇 Unmute" : "🎙️ Mute"}
        </button>
        <button
          onClick={onEnd}
          className="flex-1 rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
        >
          ✕ End call
        </button>
      </div>
    </div>
  );
}
