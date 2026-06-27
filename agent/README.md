# agent/

This folder will hold the **existing LiveKit Python voice agent** (the AI that answers
the phone for the cleaning service).

> ⏳ Placeholder — the agent code will be dropped in here later.

## What it will do

- Connect to the same LiveKit room the browser caller joins (see [`../web-caller`](../web-caller)).
- Subscribe to the caller's microphone audio, run STT → LLM → TTS, and publish the
  agent's voice back into the room.

## Configuration

The agent uses the server-side LiveKit credentials from the root [`.env.example`](../.env.example):

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Copy `../.env.example` to `.env` (or export the vars) before running the agent.
