"""One reviewed submission per conversation, independent of retried tool calls.

The backend stores the identity and receipt durably. Browser/worker restart
handoff of this reference belongs to the call lifecycle integration.
"""

import asyncio
import copy
import secrets
import uuid
from collections.abc import Awaitable, Callable
from typing import Any


class SubmissionRejectedError(Exception):
    """An authoritative rejection before any uncertain attempt."""


class SubmissionUnclearError(Exception):
    """Keep this identity and reconcile; never announce success or start anew."""


class Submission:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._approved: dict[str, Any] | None = None
        self._payload: dict[str, Any] | None = None
        self._token = ""
        self._receipt: dict[str, Any] | None = None
        self._uncertain = False

    async def save(
        self,
        approved: dict[str, Any],
        send: Callable[[dict[str, Any], str], Awaitable[dict[str, Any]]],
    ) -> dict[str, Any]:
        async with self._lock:
            if approved.get("reviewed") is not True:
                raise SubmissionRejectedError(
                    "Review the complete details with the caller first."
                )
            if self._approved is not None and approved != self._approved:
                raise SubmissionUnclearError(
                    "The earlier submission must be resolved; do not submit changed details."
                )
            if self._receipt:
                return copy.deepcopy(self._receipt)
            if self._approved is None:
                self._approved = copy.deepcopy(approved)
                self._payload = {
                    **copy.deepcopy(approved),
                    "submission_id": str(uuid.uuid4()),
                }
                self._token = secrets.token_urlsafe(32)
            for attempt in range(2):
                try:
                    receipt = await asyncio.wait_for(
                        send(copy.deepcopy(self._payload), self._token), timeout=10
                    )
                    if (
                        not isinstance(receipt, dict)
                        or not isinstance(receipt.get("booking_id"), str)
                        or not receipt["booking_id"].strip()
                        or receipt.get("status") != "created"
                        or receipt.get("booking_status") != "requested"
                        or receipt.get("submission_id")
                        != self._payload["submission_id"]
                        or receipt.get("tentative") is not True
                    ):
                        raise SubmissionUnclearError(
                            "Backend did not return a persisted tentative receipt."
                        )
                    self._receipt = copy.deepcopy(receipt)
                    return receipt
                except asyncio.CancelledError:
                    self._uncertain = True
                    raise
                except SubmissionRejectedError:
                    if self._uncertain:
                        raise SubmissionUnclearError(
                            "An earlier attempt may have saved; check the same submission."
                        ) from None
                    self._approved = self._payload = None
                    raise
                except (TimeoutError, OSError, SubmissionUnclearError):
                    self._uncertain = True
                    if attempt == 1:
                        raise SubmissionUnclearError(
                            "Save outcome unclear. Retry only this same submission."
                        ) from None
            raise AssertionError("unreachable")
