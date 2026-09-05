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
