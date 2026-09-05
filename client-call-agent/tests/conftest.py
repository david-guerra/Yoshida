"""Offline SDK construction must not need a developer's real credentials."""

import os

import pytest


@pytest.fixture(autouse=True)
def offline_livekit_credentials(monkeypatch):
    if os.getenv("RUN_LIVEKIT_EVALS") == "1":
        return
    # Construction only; the offline suite never starts an inference request.
    for name in ("LIVEKIT_API_KEY", "LIVEKIT_INFERENCE_API_KEY"):
        monkeypatch.setenv(name, "offline-test-key")
    for name in ("LIVEKIT_API_SECRET", "LIVEKIT_INFERENCE_API_SECRET"):
        monkeypatch.setenv(name, "offline-test-secret-not-a-real-key-0000")
    monkeypatch.setenv("LIVEKIT_URL", "ws://127.0.0.1:7880")
