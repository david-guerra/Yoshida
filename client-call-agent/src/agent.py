import json
import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
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

logger = logging.getLogger("agent")

load_dotenv(".env.local")

PROMPT_PATH = (
    Path(__file__).resolve().parents[1] / "prompts" / "caller-agent-master-prompt.md"
)
DEFAULT_POCKETBASE_URL = "https://snowiness-difficult-finer.ngrok-free.dev"
DEFAULT_LIVEKIT_INFERENCE_LLM_MODEL = "deepseek-ai/deepseek-v4-pro"
DEFAULT_SIMULATED_CALLER_PHONE = "+491700000002"


def cleanvoice_pocketbase_url() -> str:
    return os.getenv("CLEANVOICE_POCKETBASE_URL", DEFAULT_POCKETBASE_URL).rstrip("/")


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
    return f"""{prompt}

## Runtime Demo Call Context

This is a simulated LiveKit call. The caller phone number has already been
imported from the call metadata.

- `caller_phone`: `{runtime_caller_phone}`

Do not ask the caller to provide their phone number. If useful, you may confirm
it once in a natural way, for example: "Ist das weiterhin Ihre Nummer?" If the
caller says the number is wrong, use the corrected number from the caller from
that point onward.

## Preloaded PocketBase Call Context

This context was loaded before the agent joined the room. Treat it as the only
stored business context for the opening path. Do not mention the preload or raw
JSON to the caller.

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
        self, *, base_url: str | None = None, session: Any | None = None
    ) -> None:
        self.base_url = (base_url or cleanvoice_pocketbase_url()).rstrip("/")
        self._session = session

    @property
    def session(self) -> Any:
        if self._session is not None:
            return self._session
        return utils.http_context.http_session()

    async def _json_or_tool_error(self, response: Any, action: str) -> dict[str, Any]:
        if response.status != 200:
            body = await response.text()
            raise ToolError(f"{action} failed with status {response.status}: {body}")
        data = await response.json()
        if not isinstance(data, dict):
            raise ToolError(f"{action} returned an unexpected response.")
        return data

    async def identify_caller(self, caller_phone: str) -> dict[str, Any]:
        async with self.session.post(
            f"{self.base_url}/api/cleanvoice/identify-caller",
            headers={
                "ngrok-skip-browser-warning": "true",
                "Content-Type": "application/json",
            },
            json={"caller_phone": caller_phone},
        ) as response:
            return await self._json_or_tool_error(response, "identify_caller")

    async def get_cleaner_briefing(self, caller_phone: str) -> dict[str, Any]:
        encoded_phone = quote(caller_phone, safe="")
        async with self.session.get(
            f"{self.base_url}/api/cleanvoice/cleaner-briefing?phone={encoded_phone}",
            headers={"ngrok-skip-browser-warning": "true"},
        ) as response:
            return await self._json_or_tool_error(response, "get_cleaner_briefing")

    async def get_cleaner_preferences(self, caller_phone: str) -> dict[str, Any]:
        encoded_phone = quote(caller_phone, safe="")
        async with self.session.get(
            f"{self.base_url}/api/cleanvoice/cleaner-preferences?phone={encoded_phone}",
            headers={"ngrok-skip-browser-warning": "true"},
        ) as response:
            return await self._json_or_tool_error(response, "get_cleaner_preferences")

    async def suggest_cleaner(self, booking_request: dict[str, Any]) -> dict[str, Any]:
        async with self.session.post(
            f"{self.base_url}/api/cleanvoice/suggest-cleaner",
            headers={
                "ngrok-skip-browser-warning": "true",
                "Content-Type": "application/json",
            },
            json=booking_request,
        ) as response:
            return await self._json_or_tool_error(response, "suggest_cleaner")

    async def create_booking(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with self.session.post(
            f"{self.base_url}/api/cleanvoice/create-booking",
            headers={
                "ngrok-skip-browser-warning": "true",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as response:
            return await self._json_or_tool_error(response, "create_booking")


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
            context["cleaner_briefing"] = await pocketbase.get_cleaner_briefing(
                caller_phone
            )
            context["cleaner_preferences"] = await pocketbase.get_cleaner_preferences(
                caller_phone
            )
        return context
    except Exception as exc:
        logger.warning("PocketBase preload failed for caller %s: %s", caller_phone, exc)
        return {
            "lookup_status": "unavailable",
            "caller_phone": caller_phone,
            "role": "unknown",
            "error": str(exc),
        }


class Assistant(Agent):
    def __init__(
        self,
        *,
        caller_phone: str | None = None,
        call_context: dict[str, Any] | None = None,
    ) -> None:
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
        """Get cleaner working hours, preferred services, service locations, and business rules.

        Use this only when a cleaner caller asks about their own stored profile
        context or when the preloaded cleaner preferences are unavailable.

        Args:
            caller_phone: The cleaner phone number in E.164 format, for example +491700000001.
        """

        return await PocketBaseClient().get_cleaner_preferences(caller_phone)

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
        return await PocketBaseClient().suggest_cleaner(booking_request)

    @function_tool(
        raw_schema={
            "type": "function",
            "name": "create_booking",
            "description": (
                "Create a tentative cleaning booking in PocketBase after collecting "
                "the caller phone, optional cleaner_phone from suggest_cleaner, "
                "client, address, booking, booking_notes, and client_preferences fields."
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

        context.disallow_interruptions()
        payload = raw_arguments.get("payload")
        if not isinstance(payload, dict):
            raise ToolError("create_booking requires a payload object.")
        return await PocketBaseClient().create_booking(payload)


server = AgentServer()


@server.rtc_session(agent_name="client-call-agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }
    caller_phone = caller_phone_from_job_metadata(ctx.job.metadata)
    call_context = await preload_call_context(caller_phone)

    tts_options = {"model": "elevenlabs/eleven_flash_v2_5", "language": "de"}
    if elevenlabs_voice_id := os.getenv("ELEVENLABS_VOICE_ID"):
        tts_options["voice"] = elevenlabs_voice_id

    # Set up a voice AI pipeline using LiveKit Inference, ElevenLabs, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=inference.TTS(**tts_options),
        # The LiveKit turn detector determines when the user is done speaking and the agent should respond.
        # TurnDetector is an end-of-turn model that listens to the user's audio directly, combining
        # semantic understanding with acoustic cues (intonation, pitch, rhythm) for state-of-the-art accuracy.
        # AgentSession supplies the required VAD automatically.
        # See more at https://docs.livekit.io/agents/build/turns
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(caller_phone=caller_phone, call_context=call_context),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = anam.AvatarSession(
    #     persona_config=anam.PersonaConfig(
    #         name="...",
    #         avatarId="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/anam
    #     ),
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Join the room and connect to the user.
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
