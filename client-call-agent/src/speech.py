"""Supported speech configuration with explicit, non-nested connection budgets."""

import os
from typing import Any

from livekit.agents import APIConnectOptions, inference
from livekit.agents.voice.agent_session import SessionConnectOptions

DEFAULT_TTS_MODEL = "cartesia/sonic-3.5"
DEFAULT_TTS_VOICE = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
RETIRED_TTS_MODELS = {
    "cartesia/sonic",
    "elevenlabs/eleven_flash_v2",
    "elevenlabs/eleven_flash_v2_5",
    "elevenlabs/eleven_turbo_v2",
    "elevenlabs/eleven_turbo_v2_5",
}


def build_tts(*, http_session: Any = None):
    model = os.getenv("LIVEKIT_INFERENCE_TTS_MODEL", DEFAULT_TTS_MODEL).strip()
    voice = os.getenv("LIVEKIT_INFERENCE_TTS_VOICE", DEFAULT_TTS_VOICE).strip()
    if not model or model.split(":", 1)[0] in RETIRED_TTS_MODELS or not voice:
        raise ValueError("Configure a supported TTS model and nonempty stock voice.")
    for suffix in ("API_KEY", "API_SECRET"):
        value = os.getenv(
            f"LIVEKIT_INFERENCE_{suffix}", os.getenv(f"LIVEKIT_{suffix}", "")
        )
        if not value.strip():
            raise ValueError("LiveKit inference credentials are required.")
    return inference.TTS(
        model=model,
        voice=voice,
        language="de",
        http_session=http_session,
        conn_options=APIConnectOptions(max_retry=0, timeout=10),
    )


def session_connect_options() -> SessionConnectOptions:
    # Only the SDK's safe connection/stream retry is permitted. Never replay a
    # generate_reply call or a potentially mutating tool turn on speech errors.
    return SessionConnectOptions(
        stt_conn_options=APIConnectOptions(max_retry=1, timeout=5, retry_interval=0),
        llm_conn_options=APIConnectOptions(max_retry=0, timeout=10),
        tts_conn_options=APIConnectOptions(max_retry=1, timeout=5, retry_interval=0),
        max_unrecoverable_errors=1,
    )
