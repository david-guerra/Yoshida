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
    def __init__(
        self, *, submission_id: str | None = None, recovery_token: str | None = None
    ) -> None:
        if (submission_id is None) != (recovery_token is None):
            raise ValueError("Submission identity and token must be provided together")
        if submission_id is not None and (
            not submission_id.strip() or not recovery_token.strip()
        ):
            raise ValueError("Submission identity and token must be nonempty")
        self._fixed_id = submission_id
        self._fixed_token = recovery_token
        self._pending: set[asyncio.Task] = set()
        self._lock = asyncio.Lock()
        self._approved: dict[str, Any] | None = None
        self._payload: dict[str, Any] | None = None
        self._token = ""
        self._receipt: dict[str, Any] | None = None
        self._uncertain = False

    async def save_durable(self, approved, send) -> dict[str, Any]:
        # Retain a strong reference and drain during job shutdown. Cancellation
        # of the speech/tool waiter must not cancel the in-flight mutation.
        return await asyncio.shield(self.begin_save(approved, send))

    def begin_save(self, approved, send) -> asyncio.Task:
        task = asyncio.create_task(self.save(copy.deepcopy(approved), send))
        self._pending.add(task)
        task.add_done_callback(self._finished)
        return task

    def _finished(self, task: asyncio.Task) -> None:
        self._pending.discard(task)
        if not task.cancelled():
            task.exception()  # Retrieve errors even if speech no longer awaits us.

    async def drain(self) -> None:
        if self._pending:
            await asyncio.shield(asyncio.gather(*self._pending, return_exceptions=True))

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
                    "submission_id": self._fixed_id or str(uuid.uuid4()),
                }
                self._token = self._fixed_token or secrets.token_urlsafe(32)
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
