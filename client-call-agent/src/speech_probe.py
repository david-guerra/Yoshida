"""Opt-in German TTS probe. Reports aggregates only and never places a call."""

import argparse
import asyncio
import json
import logging

import aiohttp
from dotenv import load_dotenv
from livekit.agents import APIConnectOptions

from speech import build_tts


async def probe(tts_factory=build_tts) -> dict:
    async def run():
        async with aiohttp.ClientSession() as http:
            tts = tts_factory(http_session=http)
            stream = None
            try:
                stream = tts.synthesize(
                    "Guten Tag. Wie kann ich Ihnen bei Ihrer Reinigungsanfrage helfen?",
                    conn_options=APIConnectOptions(max_retry=0, timeout=10),
                )

                async def collect():
                    size, nonzero, frames = 0, False, 0
                    async for audio in stream:
                        pcm = bytes(audio.frame.data)
                        size += len(pcm)
                        nonzero |= any(pcm)
                        frames += 1
                    return {
                        "ok": size > 0 and nonzero,
                        "frames": frames,
                        "pcm_bytes": size,
                    }

                return await asyncio.wait_for(collect(), timeout=10)
            finally:
                try:
                    if stream is not None:
                        await stream.aclose()
                finally:
                    await tts.aclose()

    try:
        return await asyncio.wait_for(run(), timeout=25)
    except Exception:
        return {
            "ok": False,
            "error": "Speech probe failed or exceeded its time budget.",
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run",
        action="store_true",
        help="Explicitly send a German synthesis request to the configured provider",
    )
    args = parser.parse_args()
    if not args.run:
        parser.error("Pass --run to opt in to a provider request.")
    load_dotenv(".env.local")
    logging.disable(logging.CRITICAL)
    result = asyncio.run(probe())
    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
