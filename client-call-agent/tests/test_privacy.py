"""Privacy boundaries use synthetic data and never contact a provider."""

import logging
from urllib.parse import urlparse

import pytest

from agent import PocketBaseClient, preload_call_context


def test_unconfigured_backend_stays_on_loopback(monkeypatch):
    monkeypatch.delenv("CLEANVOICE_POCKETBASE_URL", raising=False)
    monkeypatch.delenv("POCKETBASE_URL", raising=False)
    assert urlparse(PocketBaseClient().base_url).hostname in {
        "127.0.0.1",
        "localhost",
        "::1",
    }


@pytest.mark.asyncio
async def test_preload_failure_does_not_repeat_contact_or_backend_response(caplog):
    phone = "+12025550102"
    private_response = "synthetic-client@example.test private-response-marker"

    class UnavailableBackend:
        async def identify_caller(self, caller_phone):
            raise RuntimeError(private_response)

    with caplog.at_level(logging.WARNING, logger="agent"):
        context = await preload_call_context(phone, client=UnavailableBackend())

    assert context["lookup_status"] == "unavailable"
    assert context["caller_phone"] == phone
    assert phone not in caplog.text
    assert private_response not in caplog.text
    assert private_response not in str(context)


@pytest.mark.asyncio
async def test_language_lookup_failure_does_not_log_personal_context(caplog):
    from agent import enrich_booking_payload_with_cleaner_language

    phone = "+12025550101"
    private_response = "synthetic-cleaner@example.test private-response-marker"

    class UnavailableBackend:
        async def get_cleaner_preferences(self, caller_phone):
            raise RuntimeError(private_response)

    with caplog.at_level(logging.WARNING, logger="agent"):
        result = await enrich_booking_payload_with_cleaner_language(
            {"cleaner_phone": phone}, UnavailableBackend()
        )

    assert result["cleaner_language"] == "en"
    assert phone not in caplog.text
    assert private_response not in caplog.text


@pytest.mark.asyncio
async def test_failed_booking_does_not_send_raw_backend_body_to_model():
    from livekit.agents.llm import ToolError

    class FailedResponse:
        status = 500

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def text(self):
            return "synthetic-client@example.test private-response-marker"

    class BackendSession:
        def post(self, *args, **kwargs):
            return FailedResponse()

    with pytest.raises(ToolError) as raised:
        await PocketBaseClient(session=BackendSession()).create_booking({})
    assert "500" in str(raised.value)
    assert "private-response-marker" not in str(raised.value)
    assert "example.test" not in str(raised.value)
