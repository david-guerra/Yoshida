import asyncio
import json
import logging
import math
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    APIConnectOptions,
    JobContext,
    RunContext,
    TurnHandlingOptions,
    cli,
    function_tool,
    inference,
    room_io,
    utils,
)
from livekit.agents.llm import ToolError
from livekit.plugins import ai_coustics

from call_server import CallServerClient, WorkerEvents
from speech import build_tts, session_connect_options
from submission import Submission, SubmissionRejectedError, SubmissionUnclearError

logger = logging.getLogger("agent")

load_dotenv(".env.local")

PROMPT_PATH = (
    Path(__file__).resolve().parents[1] / "prompts" / "caller-agent-master-prompt.md"
)
DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090"
DEFAULT_LIVEKIT_INFERENCE_LLM_MODEL = "deepseek-ai/deepseek-v4-pro"
DEFAULT_SIMULATED_CALLER_PHONE = "+12025550102"
DEFAULT_CLEANER_LANGUAGE = "en"
SUPPORTED_CLEANER_LANGUAGES = {"ar", "de", "en", "pl", "ru", "tr", "uk"}
AGENT_TIMEZONE = "Europe/Berlin"


def cleanvoice_pocketbase_url() -> str:
    return os.getenv(
        "CLEANVOICE_POCKETBASE_URL",
        os.getenv("POCKETBASE_URL", DEFAULT_POCKETBASE_URL),
    ).rstrip("/")


def simulated_caller_phone() -> str:
    return os.getenv("SIMULATED_CALLER_PHONE", DEFAULT_SIMULATED_CALLER_PHONE).strip()


def caller_phone_from_job_metadata(metadata: str | None) -> str:
    if metadata:
        try:
            parsed = json.loads(metadata)
        except json.JSONDecodeError:
            parsed = {}
        if isinstance(parsed, dict):
            caller_phone = parsed.get("caller_phone") or parsed.get("callerPhone")
            if isinstance(caller_phone, str) and caller_phone.strip():
                return caller_phone.strip()
    return simulated_caller_phone()


def _format_call_context(call_context: dict[str, Any]) -> str:
    return json.dumps(call_context, ensure_ascii=False, sort_keys=True, indent=2)


def _valid_cleaner_language(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    language = value.strip().lower()
    return language if language in SUPPORTED_CLEANER_LANGUAGES else None


def cleaner_summary_language(value: Any) -> str:
    return _valid_cleaner_language(value) or DEFAULT_CLEANER_LANGUAGE


def _language_from_mapping(data: Any) -> str | None:
    if not isinstance(data, dict):
        return None

    direct_fields = ("cleaner_language", "preferred_language", "language")
    for field in direct_fields:
        if language := _valid_cleaner_language(data.get(field)):
            return language

    for parent_key in ("cleaner", "preferences"):
        nested = data.get(parent_key)
        if isinstance(nested, dict):
            for field in ("preferred_language", "language", "cleaner_language"):
                if language := _valid_cleaner_language(nested.get(field)):
                    return language

    return None


async def enrich_booking_payload_with_cleaner_language(
    payload: dict[str, Any], pocketbase: Any
) -> dict[str, Any]:
    enriched = dict(payload)
    language = _language_from_mapping(enriched)
    cleaner_phone = enriched.get("cleaner_phone")

    if language is None and isinstance(cleaner_phone, str) and cleaner_phone.strip():
        try:
            preferences = await pocketbase.get_cleaner_preferences(cleaner_phone)
        except Exception:
            logger.warning("Cleaner language lookup failed; using default language")
            preferences = {}
        language = _language_from_mapping(preferences)

    language = language or DEFAULT_CLEANER_LANGUAGE
    cleaner = (
        dict(enriched["cleaner"]) if isinstance(enriched.get("cleaner"), dict) else {}
    )
    cleaner["preferred_language"] = language
    enriched["cleaner"] = cleaner
    enriched["cleaner_language"] = language

    return enriched


def load_caller_agent_prompt(
    *, caller_phone: str | None = None, call_context: dict[str, Any] | None = None
) -> str:
    prompt = PROMPT_PATH.read_text(encoding="utf-8")
    runtime_caller_phone = (caller_phone or simulated_caller_phone()).strip()
    runtime_call_context = call_context or {
        "lookup_status": "not_preloaded",
        "caller_phone": runtime_caller_phone,
        "role": "unknown",
    }
    now = datetime.now(ZoneInfo(AGENT_TIMEZONE)).strftime("%A, %d %B %Y, %H:%M %Z")
    return f"""{prompt}

## Current Date And Time

The current date and time is {now}. Use this as the reference for any dates the
caller mentions (for example "next Friday" or "the 22nd"). Resolve every date to
a concrete date in the correct current year, and never book a date in the past.

## Runtime Demo Call Context

This is a simulated LiveKit call. The caller phone number has already been
imported from the call metadata.

- `caller_phone`: `{runtime_caller_phone}`

Do not ask the caller to provide their phone number. If useful, you may confirm
it once in a natural way, for example: "Ist das weiterhin Ihre Nummer?" If the
caller says the number is wrong, use the corrected number from the caller from
that point onward.

## Preloaded PocketBase Call Context

Context may arrive after the greeting. Use stored facts only when available;
never overwrite details already reviewed with the caller. Apply late context at
the next natural conversational boundary without another greeting or a forced
briefing. Do not mention the preload or raw JSON to the caller.

```json
{_format_call_context(runtime_call_context)}
```
"""


def build_llm() -> Any:
    return inference.LLM(
        model=os.getenv(
            "LIVEKIT_INFERENCE_LLM_MODEL",
            DEFAULT_LIVEKIT_INFERENCE_LLM_MODEL,
        )
    )


class PocketBaseClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        session: Any | None = None,
        event: Any | None = None,
    ) -> None:
        self.base_url = (base_url or cleanvoice_pocketbase_url()).rstrip("/")
        self._session = session
        self._event = event

    @property
    def session(self) -> Any:
        if self._session is not None:
            return self._session
        return utils.http_context.http_session()

    async def _json_or_tool_error(self, response: Any, action: str) -> dict[str, Any]:
        if not 200 <= response.status < 300:
            raise ToolError(f"{action} failed with status {response.status}")
        data = await response.json()
        if not isinstance(data, dict):
            raise ToolError(f"{action} returned an unexpected response.")
        return data

    async def _lookup(self, method: str, path: str, payload=None) -> dict[str, Any]:
        if self._event:
            await self._event("lookup")
        try:
            for attempt in range(2):
                try:
                    kwargs = {
                        "headers": {"ngrok-skip-browser-warning": "true"},
                        "timeout": aiohttp.ClientTimeout(
                            total=5, ceil_threshold=float("inf")
                        ),
                    }
                    if payload is not None:
                        kwargs["json"] = payload
                        kwargs["headers"]["Content-Type"] = "application/json"
                    async with getattr(self.session, method)(
                        f"{self.base_url}{path}", **kwargs
                    ) as response:
                        if response.status == 408 or response.status >= 500:
                            raise OSError("Lookup temporarily unavailable")
                        return await self._json_or_tool_error(response, "Lookup")
                except (aiohttp.ClientError, TimeoutError, OSError):
                    if attempt == 1:
                        raise ToolError(
                            "Die Reinigungskraft kann gerade nicht geprüft werden. Ihre Anfrage wurde noch nicht gesendet."
                        ) from None
                except ValueError:
                    raise ToolError("Lookup returned an unusable response.") from None
            raise AssertionError("unreachable")
        finally:
            if self._event:
                await self._event("listening")

    async def identify_caller(self, caller_phone: str) -> dict[str, Any]:
        return await self._lookup(
            "post", "/api/cleanvoice/identify-caller", {"caller_phone": caller_phone}
        )

    async def get_cleaner_briefing(self, caller_phone: str) -> dict[str, Any]:
        return await self._lookup(
            "get",
            f"/api/cleanvoice/cleaner-briefing?phone={quote(caller_phone, safe='')}",
        )

    async def get_cleaner_preferences(self, caller_phone: str) -> dict[str, Any]:
        return await self._lookup(
            "get",
            f"/api/cleanvoice/cleaner-preferences?phone={quote(caller_phone, safe='')}",
        )

    async def suggest_cleaner(self, booking_request: dict[str, Any]) -> dict[str, Any]:
        return await self._lookup(
            "post", "/api/cleanvoice/suggest-cleaner", booking_request
        )

    async def create_booking(
        self, payload: dict[str, Any], recovery_token: str = ""
    ) -> dict[str, Any]:
        try:
            async with self.session.post(
                f"{self.base_url}/api/cleanvoice/create-booking",
                headers={
                    "ngrok-skip-browser-warning": "true",
                    "Content-Type": "application/json",
                    "X-Submission-Token": recovery_token,
                },
                json=payload,
            ) as response:
                if response.status in (408, 409):
                    raise SubmissionUnclearError(
                        "Submission may already exist; reconcile the same reference."
                    )
                if 400 <= response.status < 500:
                    raise SubmissionRejectedError(
                        f"Request rejected (HTTP {response.status}); clarify the reviewed details."
                    )
                if response.status >= 500:
                    raise SubmissionUnclearError(
                        "Backend unavailable; the save outcome is unclear."
                    )
                data = await response.json()
                if not isinstance(data, dict):
                    raise SubmissionUnclearError("Backend returned no usable receipt.")
                return data
        except (aiohttp.ClientError, ValueError) as error:
            raise SubmissionUnclearError(
                "Save response was interrupted; reconcile this submission."
            ) from error


async def preload_call_context(
    caller_phone: str, *, client: PocketBaseClient | None = None
) -> dict[str, Any]:
    pocketbase = client or PocketBaseClient()
    try:
        identity = await pocketbase.identify_caller(caller_phone)
        role = (
            identity.get("role") if isinstance(identity.get("role"), str) else "unknown"
        )
        context: dict[str, Any] = {
            "lookup_status": "available",
            "caller_phone": caller_phone,
            "role": role,
            "identify_caller": identity,
        }
        if role == "cleaner":
            briefing, preferences = await asyncio.gather(
                pocketbase.get_cleaner_briefing(caller_phone),
                pocketbase.get_cleaner_preferences(caller_phone),
            )
            context["cleaner_briefing"] = briefing
            context["cleaner_preferences"] = preferences
        return context
    except Exception:
        logger.warning("PocketBase preload failed; continuing without stored context")
        return {
            "lookup_status": "unavailable",
            "caller_phone": caller_phone,
            "role": "unknown",
            "error": "PocketBase is unavailable",
        }


class Assistant(Agent):
    def __init__(
        self,
        *,
        caller_phone: str | None = None,
        call_context: dict[str, Any] | None = None,
        submission: Submission | None = None,
        submit_client: Any | None = None,
        lookup_client: Any | None = None,
        event: Any | None = None,
    ) -> None:
        self._submission = submission or Submission()
        self._submit_client = submit_client or PocketBaseClient()
        self._lookup_client = lookup_client or PocketBaseClient()
        self._event = event
        super().__init__(
            # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
            # See all available models at https://docs.livekit.io/agents/models/llm/
            llm=build_llm(),
            instructions=load_caller_agent_prompt(
                caller_phone=caller_phone,
                call_context=call_context,
            ),
        )

    @function_tool()
    async def get_cleaner_preferences(
        self, context: RunContext, caller_phone: str
    ) -> dict[str, Any]:
        """Get cleaner language, working hours, preferred services, service locations, and business rules.

        Use this only when a cleaner caller asks about their own stored profile
        context or when the preloaded cleaner preferences are unavailable.

        Args:
            caller_phone: The cleaner phone number in E.164 format, for example +12025550101.
        """

        return await self._lookup_client.get_cleaner_preferences(caller_phone)

    @function_tool(
        raw_schema={
            "type": "function",
            "name": "suggest_cleaner",
            "description": (
                "Suggest whether a cleaner fits the requested booking before "
                "creating the tentative booking."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_request": {
                        "type": "object",
                        "description": (
                            "Booking match request with service_type, city, postal_code, "
                            "start_time, and optional estimated_budget."
                        ),
                        "additionalProperties": True,
                    }
                },
                "required": ["booking_request"],
                "additionalProperties": False,
            },
        }
    )
    async def suggest_cleaner(
        self, raw_arguments: dict[str, Any], context: RunContext
    ) -> dict[str, Any]:
        """Suggest a cleaner for a requested cleaning job."""

        booking_request = raw_arguments.get("booking_request")
        if not isinstance(booking_request, dict):
            raise ToolError("suggest_cleaner requires a booking_request object.")
        await context.update(
            "Ich prüfe kurz, welche Reinigungskraft zu dieser Anfrage passt."
        )
        return await self._lookup_client.suggest_cleaner(booking_request)

    @function_tool(
        raw_schema={
            "type": "function",
            "name": "create_booking",
            "description": (
                "Create a tentative cleaning booking in PocketBase after collecting "
                "the caller phone, optional cleaner_phone from suggest_cleaner, "
                "cleaner_language, client, address, booking with positive "
                "estimated_hours, booking_notes, "
                "and client_preferences fields."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "payload": {
                        "type": "object",
                        "description": "The full create-booking JSON payload.",
                        "additionalProperties": True,
                    }
                },
                "required": ["payload"],
                "additionalProperties": False,
            },
        }
    )
    async def create_booking(
        self, raw_arguments: dict[str, Any], context: RunContext
    ) -> dict[str, Any]:
        """Create a tentative cleaning booking in PocketBase."""

        payload = raw_arguments.get("payload")
        if not isinstance(payload, dict):
            raise ToolError("create_booking requires a payload object.")
        booking = payload.get("booking")
        duration = booking.get("estimated_hours") if isinstance(booking, dict) else None
        if (
            isinstance(duration, bool)
            or not isinstance(duration, (int, float))
            or not math.isfinite(duration)
            or duration <= 0
        ):
            raise ToolError(
                "Die positive Dauer fehlt. Fragen Sie nach der gewünschten Dauer "
                "in Stunden, lesen Sie die vollständige Zusammenfassung erneut vor "
                "und holen Sie eine neue ausdrückliche Freigabe ein, bevor Sie speichern."
            )
        context.disallow_interruptions()
        save_task = self._submission.begin_save(
            payload, self._submit_client.create_booking
        )
        try:
            try:
                await asyncio.wait_for(
                    context.update(
                        "Ich speichere die Anfrage kurz für die Reinigungskraft."
                    ),
                    timeout=5,
                )
            except Exception:
                if self._event:
                    await self._event("speech_error")
            return await asyncio.shield(save_task)
        except (SubmissionRejectedError, SubmissionUnclearError) as error:
            raise ToolError(str(error)) from None


server = AgentServer(shutdown_process_timeout=35)


@server.rtc_session(agent_name="client-call-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    caller_phone = caller_phone_from_job_metadata(ctx.job.metadata)
    try:
        call = CallServerClient.from_metadata(ctx.job.metadata)
    except ValueError:
        logger.warning("Invalid browser call configuration")
        ctx.shutdown("Invalid call configuration")
        return
    if call is not None and not await call.is_active():
        ctx.shutdown("Call is no longer active")
        return

    # LiveKit exposes the local participant only after session.start joins.
    # Server-side status events can still be queued before that point.
    events = WorkerEvents(call)
    submission = (
        Submission(
            submission_id=call.submission_id, recovery_token=call.submission_token
        )
        if call
        else Submission()
    )
    lookup_client = PocketBaseClient(event=events.lookup_event)
    preload_task = asyncio.create_task(
        preload_call_context(caller_phone, client=lookup_client)
    )

    providers = []

    async def shutdown():
        preload_task.cancel()
        await asyncio.gather(preload_task, return_exceptions=True)
        await submission.drain()
        await events.drain()
        await asyncio.gather(
            *(provider.aclose() for provider in providers), return_exceptions=True
        )

    ctx.add_shutdown_callback(shutdown)

    session = None
    try:
        stt = inference.STT(
            model="deepgram/nova-3",
            language="multi",
            conn_options=APIConnectOptions(max_retry=0, timeout=5),
        )
        providers.append(stt)
        tts = build_tts()
        providers.append(tts)
        session = AgentSession(
            stt=stt,
            tts=tts,
            turn_handling=TurnHandlingOptions(
                turn_detection=inference.TurnDetector(
                    conn_options=APIConnectOptions(max_retry=0, timeout=5)
                )
            ),
            conn_options=session_connect_options(),
            preemptive_generation=False,
        )

        @session.on("error")
        def on_error(event):
            if not getattr(event.error, "recoverable", False):
                events.queue("speech_error")

        @session.on("agent_state_changed")
        def on_state(event):
            if event.new_state in {"listening", "thinking", "speaking"}:
                events.queue(event.new_state)

        loading_context = {
            "lookup_status": "loading",
            "caller_phone": caller_phone,
            "role": "unknown",
        }
        assistant = Assistant(
            caller_phone=caller_phone,
            call_context=loading_context,
            submission=submission,
            submit_client=call,
            lookup_client=lookup_client,
            event=events.publish,
        )
        if assistant.llm is not None:
            providers.append(assistant.llm)
        await session.start(
            agent=assistant,
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=ai_coustics.audio_enhancement(
                        model=ai_coustics.EnhancerModel.QUAIL_VF_S
                    ),
                ),
            ),
        )
        events.bind_participant(ctx.room.local_participant)
        if call is not None and not await call.is_active():
            await session.aclose()
            ctx.shutdown("Call ended during worker startup")
            return
        events.queue("ready")
        # No background audio: only this assistant's speech can satisfy the
        # browser's first-playback evidence. Context lookup never gates greeting.
        await session.generate_reply(
            instructions=(
                "Greet the caller in German. Say that this is the Reinigung front desk, "
                "ask how you can help with the cleaning request, and keep it to one short sentence."
            )
        )
        call_context = await preload_task
        await assistant.update_instructions(
            load_caller_agent_prompt(
                caller_phone=caller_phone, call_context=call_context
            )
        )
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.warning("Speech session failed; publishing caller recovery status")
        await events.publish("speech_error")
        if session is not None:
            await session.aclose()
        ctx.shutdown("Speech unavailable")


if __name__ == "__main__":
    cli.run_app(server)
