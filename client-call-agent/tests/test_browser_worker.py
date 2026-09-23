"""Offline caller-server and provider seams; never contact speech providers."""

import asyncio
import json
from types import SimpleNamespace

import pytest

from submission import Submission, SubmissionRejectedError, SubmissionUnclearError


def receipt(payload):
    return {
        "booking_id": "saved",
        "submission_id": payload["submission_id"],
        "status": "created",
        "booking_status": "requested",
        "tentative": True,
    }


@pytest.mark.asyncio
async def test_injected_reference_survives_interrupted_tool_and_shutdown_drain():
    submission = Submission(submission_id="server-id", recovery_token="server-token")
    started, finish = asyncio.Event(), asyncio.Event()
    requests = []

    async def send(payload, token):
        requests.append((payload, token))
        started.set()
        await finish.wait()
        return receipt(payload)

    task = asyncio.create_task(submission.save_durable({"reviewed": True}, send))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    finish.set()
    await submission.drain()
    assert await submission.save_durable({"reviewed": True}, send) == receipt(
        {"submission_id": "server-id"}
    )
    assert requests == [
        ({"reviewed": True, "submission_id": "server-id"}, "server-token")
    ]


class Response:
    def __init__(self, status, data):
        self.status, self.data = status, data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def json(self):
        return self.data


class HTTP:
    def __init__(self, status=200, data=None):
        self.status, self.data, self.requests = status, data, []

    def post(self, url, **kwargs):
        self.requests.append(("POST", url, kwargs))
        return Response(self.status, self.data)

    def get(self, url, **kwargs):
        self.requests.append(("GET", url, kwargs))
        return Response(self.status, self.data)


@pytest.mark.asyncio
async def test_worker_events_publish_to_server_before_room_participant_is_available():
    from call_server import WorkerEvents

    published = []

    class Call:
        call_id = "call-one"

        async def event(self, value):
            published.append(value)

    events = WorkerEvents(Call())
    await events.publish("lookup")
    assert published == ["lookup"]

    attributes = []

    async def set_attributes(value):
        attributes.append(value)

    events.bind_participant(SimpleNamespace(set_attributes=set_attributes))
    await events.publish("ready")
    assert attributes == [{"yoshida.call_id": "call-one", "yoshida.ready": "true"}]


def metadata(**overrides):
    return json.dumps(
        {
            "call_id": "call-one",
            "caller_phone": "+12025550102",
            "identity": "caller",
            "call_server_url": "http://localhost:3000",
            "worker_token": "worker-secret",
            "submission_id": "submission-one",
            "submission_token": "recovery-secret",
            **overrides,
        }
    )


@pytest.mark.asyncio
async def test_worker_hands_reviewed_payload_to_server_with_separate_worker_capability():
    from call_server import CallServerClient

    http = HTTP(data=receipt({"submission_id": "submission-one"}))
    client = CallServerClient.from_metadata(metadata(), session=http)
    result = await client.create_booking(
        {"submission_id": "submission-one", "reviewed": True}, "recovery-secret"
    )
    assert result["booking_id"] == "saved"
    method, url, request = http.requests[0]
    assert (method, url) == ("POST", "http://localhost:3000/api/calls/call-one")
    assert request["headers"]["Authorization"] == "Bearer worker-secret"
    assert request["json"] == {
        "action": "submit",
        "payload": {"submission_id": "submission-one", "reviewed": True},
    }
    assert request["timeout"].total == 10
    assert len(http.requests) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status, error",
    [
        (400, SubmissionRejectedError),
        (401, SubmissionRejectedError),
        (408, SubmissionUnclearError),
        (409, SubmissionUnclearError),
        (503, SubmissionUnclearError),
    ],
)
async def test_submit_transport_classifies_failure_without_inner_retry(status, error):
    from call_server import CallServerClient

    http = HTTP(status=status, data={"private": "not for caller"})
    with pytest.raises(error) as raised:
        await CallServerClient.from_metadata(metadata(), session=http).create_booking(
            {}, "ignored"
        )
    assert len(http.requests) == 1
    assert "private" not in str(raised.value)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "data, active",
    [
        ({"callId": "call-one", "ended": False}, True),
        ({"callId": "call-one", "ended": True}, False),
        ({"callId": "other", "ended": False}, False),
        ({}, False),
    ],
)
async def test_worker_only_joins_authoritatively_active_call(data, active):
    from call_server import CallServerClient

    http = HTTP(data=data)
    assert (
        await CallServerClient.from_metadata(metadata(), session=http).is_active()
        is active
    )
    assert http.requests[0][2]["headers"]["Authorization"] == "Bearer worker-secret"


def test_partial_browser_metadata_never_falls_back_to_unscoped_direct_submission():
    from call_server import CallServerClient

    with pytest.raises(ValueError):
        CallServerClient.from_metadata(metadata(worker_token=""))
    with pytest.raises(ValueError):
        CallServerClient.from_metadata(
            metadata(call_server_url="https://external.example")
        )
    assert CallServerClient.from_metadata('{"caller_phone":"+12025550102"}') is None


def test_supported_default_and_explicit_override_reach_tts_provider(monkeypatch):
    from unittest.mock import Mock

    import speech

    factory = Mock()
    monkeypatch.setattr(speech.inference, "TTS", factory)
    for name in ("LIVEKIT_INFERENCE_TTS_MODEL", "LIVEKIT_INFERENCE_TTS_VOICE"):
        monkeypatch.delenv(name, raising=False)
    speech.build_tts()
    opts = factory.call_args.kwargs
    assert (opts["model"], opts["voice"], opts["language"]) == (
        "cartesia/sonic-3.5",
        "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        "de",
    )
    assert opts["conn_options"].max_retry == 0
    monkeypatch.setenv("LIVEKIT_INFERENCE_TTS_MODEL", "cartesia/sonic-3")
    monkeypatch.setenv("LIVEKIT_INFERENCE_TTS_VOICE", "stock-override")
    speech.build_tts()
    assert factory.call_args.kwargs["voice"] == "stock-override"
    assert factory.call_args.kwargs["model"] == "cartesia/sonic-3"


@pytest.mark.parametrize(
    "name,value",
    [
        ("LIVEKIT_INFERENCE_TTS_MODEL", ""),
        ("LIVEKIT_INFERENCE_TTS_MODEL", "elevenlabs/eleven_flash_v2_5"),
        ("LIVEKIT_INFERENCE_TTS_MODEL", "cartesia/sonic"),
        ("LIVEKIT_INFERENCE_TTS_VOICE", " "),
        ("LIVEKIT_INFERENCE_API_KEY", ""),
    ],
)
def test_invalid_speech_configuration_fails_before_provider_request(
    monkeypatch, name, value
):
    import speech

    monkeypatch.setenv(name, value)
    with pytest.raises(ValueError):
        speech.build_tts()


@pytest.mark.asyncio
async def test_fixed_reference_is_reused_after_authoritative_rejection():
    submission = Submission(submission_id="fixed", recovery_token="token")
    requests = []

    async def send(payload, token):
        requests.append((payload, token))
        if len(requests) == 1:
            raise SubmissionRejectedError()
        return receipt(payload)

    with pytest.raises(SubmissionRejectedError):
        await submission.save({"reviewed": True}, send)
    assert (await submission.save({"reviewed": True, "corrected": True}, send))[
        "submission_id"
    ] == "fixed"
    assert requests[0][1] == requests[1][1] == "token"


@pytest.mark.asyncio
@pytest.mark.parametrize("status,count", [(503, 2), (408, 2), (401, 1), (400, 1)])
async def test_lookup_http_attempts_are_bounded_and_expose_lookup_state(status, count):
    from livekit.agents.llm import ToolError

    from agent import PocketBaseClient

    http = HTTP(status=status, data={})
    events = []

    async def event(state):
        events.append(state)

    client = PocketBaseClient(session=http, event=event)
    with pytest.raises(ToolError):
        await client.suggest_cleaner({"city": "Berlin"})
    assert len(http.requests) == count
    assert all(request[2]["timeout"].total == 5 for request in http.requests)
    assert events == ["lookup", "listening"]


@pytest.mark.asyncio
async def test_spoken_save_cue_failure_cannot_prevent_approved_submission():
    from agent import Assistant

    class Backend:
        async def create_booking(self, payload, token):
            return receipt(payload)

    class Speech:
        def disallow_interruptions(self):
            pass

        async def update(self, text):
            raise RuntimeError("private provider failure")

    assistant = Assistant(
        submission=Submission(submission_id="fixed", recovery_token="token"),
        submit_client=Backend(),
    )
    assert (
        await assistant.create_booking(
            {"payload": {"reviewed": True, "booking": {"estimated_hours": 2}}}, Speech()
        )
    )["booking_id"] == "saved"


@pytest.mark.asyncio
@pytest.mark.parametrize("duration", [None, 0, -1, True, float("nan")])
async def test_missing_duration_is_caught_before_announcing_or_sending_save(duration):
    from livekit.agents.llm import ToolError

    from agent import Assistant

    calls = []

    class Backend:
        async def create_booking(self, payload, token):
            calls.append(payload)
            return receipt(payload)

    class Speech:
        def __init__(self):
            self.blocked = False
            self.spoken = []

        def disallow_interruptions(self):
            self.blocked = True

        async def update(self, text):
            self.spoken.append(text)

    speech = Speech()
    assistant = Assistant(
        submission=Submission(submission_id="fixed", recovery_token="token"),
        submit_client=Backend(),
    )
    with pytest.raises(ToolError, match="Dauer"):
        await assistant.create_booking(
            {"payload": {"reviewed": True, "booking": {"estimated_hours": duration}}},
            speech,
        )
    assert calls == []
    assert speech.spoken == []
    assert not speech.blocked


@pytest.mark.asyncio
async def test_probe_checks_pcm_and_closes_resources_without_exposing_provider_errors():
    from types import SimpleNamespace

    from speech_probe import probe

    class Stream:
        closed = False

        def __aiter__(self):
            async def frames():
                yield SimpleNamespace(
                    frame=SimpleNamespace(
                        data=memoryview(b"\x00\x00\x01\x00"),
                        samples_per_channel=2,
                        sample_rate=24000,
                        num_channels=1,
                    )
                )

            return frames()

        async def aclose(self):
            self.closed = True

    class TTS:
        closed = False

        def synthesize(self, text, *, conn_options):
            assert conn_options.max_retry == 0
            assert conn_options.timeout == 10
            return stream

        async def aclose(self):
            self.closed = True

    stream, tts = Stream(), TTS()
    result = await probe(lambda **kw: tts)
    assert result["ok"] is True and result["pcm_bytes"] == 4
    assert stream.closed and tts.closed


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [False, True])
async def test_probe_silence_or_provider_error_is_sanitized_failure(failure):
    from types import SimpleNamespace

    from speech_probe import probe

    class Stream:
        def __aiter__(self):
            async def frames():
                if failure:
                    raise RuntimeError("SECRET private-provider-response")
                yield SimpleNamespace(
                    frame=SimpleNamespace(
                        data=memoryview(b"\x00\x00"),
                        samples_per_channel=1,
                        sample_rate=24000,
                        num_channels=1,
                    )
                )

            return frames()

        async def aclose(self):
            pass

    class TTS:
        async def aclose(self):
            pass

        def synthesize(self, *args, **kw):
            return Stream()

    result = await probe(lambda **kw: TTS())
    assert result["ok"] is False
    assert "SECRET" not in str(result)


@pytest.mark.asyncio
@pytest.mark.parametrize("active", [[False], [True, False], [True, True]])
async def test_runtime_checks_call_before_join_and_after_start_and_only_then_greets(
    monkeypatch, active
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    import agent

    traces, attrs, events, callbacks, options = [], [], [], [], {}
    checks = iter(active)
    closed = []

    class Provider:
        def __init__(self, name):
            self.name = name

        async def aclose(self):
            closed.append(self.name)

    class Call:
        call_id, submission_id, submission_token = (
            "call-one",
            "submission-one",
            "recovery-secret",
        )

        async def is_active(self):
            traces.append("active")
            return next(checks)

        async def event(self, value):
            events.append(value)

        async def create_booking(self, payload, token):
            return receipt(payload)

    class Session:
        def __init__(self, **kwargs):
            options.update(kwargs)
            self.handlers = {}

        def on(self, name):
            def register(fn):
                self.handlers[name] = fn
                return fn

            return register

        async def start(self, **kwargs):
            traces.append("join")

        async def generate_reply(self, **kwargs):
            traces.append("greeting")

        async def aclose(self):
            traces.append("closed")

    class Assistant:
        def __init__(self, **kwargs):
            options["assistant"] = kwargs
            self.llm = Provider("llm")

        async def update_instructions(self, instructions):
            traces.append("context")

    async def set_attributes(values):
        attrs.append(values)

    ctx = SimpleNamespace(
        job=SimpleNamespace(metadata=metadata()),
        room=SimpleNamespace(
            name="room",
            local_participant=SimpleNamespace(set_attributes=set_attributes),
        ),
        add_shutdown_callback=callbacks.append,
        shutdown=lambda reason: traces.append("shutdown"),
    )
    monkeypatch.setattr(agent.CallServerClient, "from_metadata", lambda raw: Call())
    monkeypatch.setattr(agent, "AgentSession", Session)
    monkeypatch.setattr(agent, "Assistant", Assistant)
    monkeypatch.setattr(agent, "build_tts", lambda: Provider("tts"))
    monkeypatch.setattr(agent.inference, "STT", lambda **kw: Provider("stt"))
    monkeypatch.setattr(
        agent.inference,
        "TurnDetector",
        lambda **kwargs: options.setdefault("turn_detector", kwargs),
    )
    monkeypatch.setattr(agent.ai_coustics, "audio_enhancement", lambda **kw: None)
    monkeypatch.setattr(
        agent,
        "preload_call_context",
        AsyncMock(return_value={"role": "cleaner", "lookup_status": "available"}),
    )
    await agent.my_agent(ctx)
    for callback in callbacks:
        await callback()
    if active == [False]:
        assert "join" not in traces and "greeting" not in traces
    elif active == [True, False]:
        assert traces[:3] == ["active", "join", "active"]
        assert "greeting" not in traces and "closed" in traces
        assert not any(values.get("yoshida.ready") == "true" for values in attrs)
    else:
        assert traces[:4] == ["active", "join", "active", "greeting"]
        assert traces.count("greeting") == 1
        assert any(
            values.get("yoshida.call_id") == "call-one"
            and values.get("yoshida.ready") == "true"
            for values in attrs
        )
        assert "ready" in events
        assert options["preemptive_generation"] is False
        assert options["conn_options"].llm_conn_options.max_retry == 0
        assert options["turn_detector"]["conn_options"].max_retry == 0
        assert options["turn_detector"]["conn_options"].timeout == 5

    if len(active) == 2:
        assert sorted(closed) == ["llm", "stt", "tts"]


@pytest.mark.asyncio
async def test_failed_speech_event_is_sanitized_on_server_and_participant(monkeypatch):
    from types import SimpleNamespace

    from call_server import WorkerEvents

    attrs, events = [], []

    async def set_attributes(values):
        attrs.append(values)

    class Call:
        call_id = "call-one"

        async def event(self, event):
            events.append(event)

    status = WorkerEvents(Call(), SimpleNamespace(set_attributes=set_attributes))
    status.queue("speech_error")
    await status.drain()
    assert events == ["speech_error"]
    assert attrs == [{"yoshida.call_id": "call-one", "yoshida.error": "speech_error"}]


@pytest.mark.asyncio
async def test_lookup_event_delivery_cannot_hold_up_lookup_or_greeting():
    from types import SimpleNamespace

    from call_server import WorkerEvents

    started, release = asyncio.Event(), asyncio.Event()

    class Call:
        call_id = "call-one"

        async def event(self, event):
            started.set()
            await release.wait()

    async def set_attributes(values):
        pass

    events = WorkerEvents(Call(), SimpleNamespace(set_attributes=set_attributes))
    try:
        await asyncio.wait_for(events.lookup_event("lookup"), timeout=0.05)
        await started.wait()
    finally:
        release.set()
        await events.drain()


@pytest.mark.asyncio
async def test_probe_deadline_closes_a_stalled_provider_stream(monkeypatch):
    import speech_probe

    timeouts, closed = [], []
    original_wait_for = asyncio.wait_for

    async def fast_wait_for(awaitable, timeout):
        timeouts.append(timeout)
        return await original_wait_for(
            awaitable, timeout=0.02 if timeout == 10 else 0.1
        )

    class Stream:
        def __aiter__(self):
            async def stalled():
                await asyncio.Future()
                yield

            return stalled()

        async def aclose(self):
            closed.append("stream")

    class TTS:
        def synthesize(self, *args, **kwargs):
            return Stream()

        async def aclose(self):
            closed.append("tts")

    monkeypatch.setattr(speech_probe.asyncio, "wait_for", fast_wait_for)
    result = await speech_probe.probe(lambda **kwargs: TTS())
    assert result["ok"] is False
    assert sorted(timeouts) == [10, 25]
    assert closed == ["stream", "tts"]
