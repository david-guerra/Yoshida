import asyncio
import copy

import aiohttp
import pytest

from submission import Submission, SubmissionRejectedError, SubmissionUnclearError


@pytest.mark.asyncio
async def test_response_lost_after_commit_retries_frozen_identity_and_returns_receipt():
    submission = Submission()
    persisted = {}
    requests = []

    async def send(payload, token):
        requests.append((copy.deepcopy(payload), token))
        key = payload["submission_id"]
        if key not in persisted:
            persisted[key] = {
                "status": "created",
                "booking_status": "requested",
                "booking_id": "saved-booking",
                "submission_id": key,
                "tentative": True,
            }
            raise TimeoutError()
        return persisted[key]

    result = await submission.save(
        {"reviewed": True, "client": {"name": "Synthetic"}}, send
    )
    assert result["booking_id"] == "saved-booking"
    assert requests[0] == requests[1]
    assert len(persisted) == 1
    assert len(requests[0][1]) >= 32
    assert (
        await submission.save({"reviewed": True, "client": {"name": "Synthetic"}}, send)
        == result
    )
    assert len(requests) == 2


@pytest.mark.asyncio
async def test_unclear_save_blocks_changed_details_and_keeps_reference():
    submission = Submission()
    requests = []

    async def send(payload, token):
        requests.append((copy.deepcopy(payload), token))
        raise TimeoutError()

    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True, "client": {"name": "First"}}, send)
    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True, "client": {"name": "Second"}}, send)
    assert len(requests) == 2
    assert requests[0] == requests[1]


@pytest.mark.asyncio
async def test_rejected_details_can_be_corrected_but_unreviewed_intake_never_sends():
    submission = Submission()
    requests = []

    async def send(payload, token):
        requests.append(payload)
        raise SubmissionRejectedError("Invalid date")

    with pytest.raises(SubmissionRejectedError):
        await submission.save({"reviewed": False}, send)
    assert requests == []
    for name in ["First", "Corrected"]:
        with pytest.raises(SubmissionRejectedError):
            await submission.save({"reviewed": True, "client": {"name": name}}, send)
    assert len(requests) == 2
    assert requests[0]["submission_id"] != requests[1]["submission_id"]


@pytest.mark.asyncio
async def test_concurrent_tool_invocations_cannot_issue_two_saves():
    submission = Submission()
    sent = []

    async def send(payload, token):
        sent.append(payload)
        await asyncio.sleep(0)
        return {
            "status": "created",
            "booking_status": "requested",
            "booking_id": "only-booking",
            "submission_id": payload["submission_id"],
            "tentative": True,
        }

    payload = {"reviewed": True}
    results = await asyncio.gather(
        submission.save(payload, send), submission.save(payload, send)
    )
    assert results[0] == results[1]
    assert len(sent) == 1


@pytest.mark.asyncio
async def test_nonreceipt_response_is_unclear_not_success():
    submission = Submission()

    async def send(payload, token):
        return {"ok": True}

    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True}, send)


@pytest.mark.asyncio
async def test_rejection_after_timeout_does_not_authorize_changed_submission():
    submission = Submission()
    attempts = []

    async def send(payload, token):
        attempts.append(payload)
        if len(attempts) == 1:
            raise TimeoutError()
        raise SubmissionRejectedError("Rejected retry")

    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True}, send)
    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True, "changed": True}, send)
    assert len(attempts) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure",
    [
        aiohttp.ServerDisconnectedError(),
        aiohttp.ClientPayloadError(),
        ValueError("bad JSON"),
    ],
)
async def test_disconnect_and_truncated_response_after_commit_are_safely_retried(
    failure,
):
    from agent import PocketBaseClient

    attempts = []

    class Response:
        status = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def json(self):
            if len(attempts) == 1:
                raise failure
            return {
                "status": "created",
                "booking_status": "requested",
                "booking_id": "committed",
                "submission_id": attempts[-1]["submission_id"],
                "tentative": True,
            }

    class Session:
        def post(self, url, *, headers, json):
            attempts.append(json)
            return Response()

    result = await Submission().save(
        {"reviewed": True}, PocketBaseClient(session=Session()).create_booking
    )
    assert result["booking_id"] == "committed"
    assert len(attempts) == 2
    assert attempts[0] == attempts[1]


@pytest.mark.asyncio
async def test_cancelled_save_cannot_later_be_misclassified_as_definitely_rejected():
    submission = Submission()
    started = asyncio.Event()

    async def send(payload, token):
        started.set()
        await asyncio.Future()

    task = asyncio.create_task(submission.save({"reviewed": True}, send))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    async def rejected(payload, token):
        raise SubmissionRejectedError("Rejected retry")

    with pytest.raises(SubmissionUnclearError):
        await submission.save({"reviewed": True}, rejected)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid",
    [
        {"booking_id": 123},
        {"booking_id": " "},
        {"status": "error"},
        {"booking_status": "confirmed"},
    ],
)
async def test_malformed_receipt_never_becomes_a_saved_tentative_request(invalid):
    async def send(payload, token):
        return {
            "status": "created",
            "booking_status": "requested",
            "booking_id": "saved",
            "submission_id": payload["submission_id"],
            "tentative": True,
            **invalid,
        }

    with pytest.raises(SubmissionUnclearError):
        await Submission().save({"reviewed": True}, send)
