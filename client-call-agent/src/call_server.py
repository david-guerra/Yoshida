"""Worker capability for one browser call; receipt durability belongs to the server."""

import asyncio
import json
from contextlib import suppress
from typing import Any
from urllib.parse import quote, urlparse

import aiohttp
from livekit.agents import utils

from submission import SubmissionRejectedError, SubmissionUnclearError


class CallServerClient:
    def __init__(self, metadata: dict[str, str], *, session: Any = None):
        self.call_id = metadata["call_id"]
        self.submission_id = metadata["submission_id"]
        self.submission_token = metadata["submission_token"]
        self.url = f"{metadata['call_server_url'].rstrip('/')}/api/calls/{quote(self.call_id, safe='')}"
        self.headers = {"Authorization": f"Bearer {metadata['worker_token']}"}
        self._session = session

    @classmethod
    def from_metadata(cls, raw: str | None, *, session: Any = None):
        try:
            data = json.loads(raw or "{}")
        except ValueError:
            raise ValueError("Invalid job metadata") from None
        if not isinstance(data, dict):
            raise ValueError("Invalid job metadata")
        fields = (
            "call_id",
            "call_server_url",
            "worker_token",
            "submission_id",
            "submission_token",
        )
        if not any(field in data for field in fields):
            return None
        if any(
            not isinstance(data.get(field), str) or not data[field].strip()
            for field in fields
        ):
            raise ValueError("Incomplete browser call metadata")
        parsed = urlparse(data["call_server_url"])
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Invalid caller server URL")
        return cls(data, session=session)

    @property
    def session(self):
        return (
            self._session
            if self._session is not None
            else utils.http_context.http_session()
        )

    async def is_active(self) -> bool:
        try:
            async with self.session.get(
                self.url, headers=self.headers, timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status != 200:
                    return False
                data = await response.json()
                return (
                    isinstance(data, dict)
                    and data.get("callId") == self.call_id
                    and data.get("ended") is False
                )
        except (aiohttp.ClientError, TimeoutError, ValueError):
            return False

    async def event(self, event: str) -> None:
        if event not in {
            "ready",
            "speech_error",
            "lookup",
            "listening",
            "thinking",
            "speaking",
        }:
            raise ValueError("Unsupported call event")
        # Status is advisory. A failed event can never erase a durable receipt.
        try:
            async with self.session.post(
                self.url,
                headers=self.headers,
                json={"action": "event", "event": event},
                timeout=aiohttp.ClientTimeout(total=5),
            ):
                pass
        except (aiohttp.ClientError, TimeoutError):
            pass

    async def create_booking(
        self, payload: dict[str, Any], recovery_token: str = ""
    ) -> dict[str, Any]:
        try:
            async with self.session.post(
                self.url,
                headers=self.headers,
                json={"action": "submit", "payload": payload},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                if response.status in (408, 409) or response.status >= 500:
                    raise SubmissionUnclearError(
                        "Save outcome unclear; check the same submission."
                    )
                if 400 <= response.status < 500:
                    raise SubmissionRejectedError(
                        "Request rejected; clarify the reviewed details."
                    )
                if not 200 <= response.status < 300:
                    raise SubmissionUnclearError("No authoritative save response.")
                data = await response.json()
                if not isinstance(data, dict):
                    raise SubmissionUnclearError("No usable receipt returned.")
                return data
        except (aiohttp.ClientError, ValueError, TimeoutError) as error:
            raise SubmissionUnclearError(
                "Save response interrupted; check the same submission."
            ) from error


class WorkerEvents:
    """Advisory speech status, independently observable when TTS is unavailable."""

    def __init__(self, call: CallServerClient | None, participant: Any = None):
        self.call = call
        self.participant = participant
        self._pending: set[asyncio.Task] = set()
        self._lock = asyncio.Lock()
        self._lookups = 0

    def bind_participant(self, participant: Any) -> None:
        """Bind the local participant only after the SDK has joined the room."""

        self.participant = participant

    def queue(self, event: str) -> None:
        if self._lookups and event in {"listening", "thinking", "speaking"}:
            return
        task = asyncio.create_task(self.publish(event))
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def lookup_event(self, event: str) -> None:
        if event == "lookup":
            self._lookups += 1
        elif event == "listening":
            self._lookups = max(0, self._lookups - 1)
            if self._lookups:
                return
        self.queue(event)

    async def publish(self, event: str) -> None:
        if self.call is None:
            return
        async with self._lock:
            attributes = {"yoshida.call_id": self.call.call_id}
            if event == "ready":
                attributes["yoshida.ready"] = "true"
            elif event == "speech_error":
                attributes["yoshida.error"] = "speech_error"
            else:
                attributes["yoshida.state"] = event
            # Local room teardown must not prevent the server error signal.
            if self.participant is not None:
                with suppress(Exception):
                    await asyncio.wait_for(
                        self.participant.set_attributes(attributes), timeout=2
                    )
            await self.call.event(event)

    async def drain(self) -> None:
        if self._pending:
            await asyncio.gather(*self._pending, return_exceptions=True)
