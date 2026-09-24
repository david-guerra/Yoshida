"""Render the silent, illustrative Yoshida showcase video.

Requires Pillow and ffmpeg. The two app captures come from docs/media and are
labelled separately from the animated reconstruction throughout the film.
"""

from __future__ import annotations

import argparse
import math
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs" / "media"
WIDTH, HEIGHT, FPS, DURATION = 1280, 720, 15, 56
FONT_FILE = Path("/System/Library/Fonts/Avenir Next.ttc")
FONT_FALLBACK = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
INK = "#22242B"
CREAM = "#F5F8F7"
MINT = "#C8E8DF"
TEAL = "#306A73"
LAVENDER = "#CDBDFA"
GREY = "#A7ABB4"
WHITE = "#FFFFFF"
BOOKING = {
    "caller": "Tom Beispiel",
    "date": "25 Sept 2026",
    "time": "10:00–12:00",
    "city": "Berlin",
    "service": "Regular cleaning",
    "address": "Kastanienallee 12",
    "duration": "2 hours",
}

CAPTIONS = [
    (0, 5, "One request. From a German call to a cleaner's decision."),
    (5, 12, "A fictional caller starts in Yoshida's browser simulator."),
    (12, 21, "Yoshida gathers the address, appointment and cleaning details in German."),
    (21, 30, "The caller approves the read-back before anything is saved."),
    (30, 37, "A tentative request is saved. The cleaner still needs to decide."),
    (37, 46, "The cleaner reviews the same request in English and confirms it."),
    (46, 52, "The confirmed booking appears in Upcoming and was checked in the backend."),
    (52, 56, "Local prototype. Fictional data. Illustrative replay."),
]


@lru_cache(maxsize=None)
def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_FILE if FONT_FILE.exists() else FONT_FALLBACK
    index = 0 if bold else 7
    return ImageFont.truetype(path, size, index=index if path == FONT_FILE else 0)


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def rounded(draw: ImageDraw.ImageDraw, box: tuple, radius: int, fill: str, outline=None, width=1):
    draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)


def label(draw: ImageDraw.ImageDraw, xy: tuple, value: str, size=22, fill=INK, bold=False):
    draw.text(xy, value, font=font(size, bold), fill=fill, stroke_width=0)


def fitted(draw: ImageDraw.ImageDraw, xy: tuple, value: str, max_width: int, size=22, fill=INK, bold=False):
    face = font(size, bold)
    while draw.textlength(value, font=face) > max_width and size > 12:
        size -= 1
        face = font(size, bold)
    draw.text(xy, value, font=face, fill=fill)


def base():
    image = Image.new("RGB", (WIDTH, HEIGHT), INK)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 6), fill=MINT)
    label(draw, (56, 28), "yoshida", 30, WHITE, True)
    label(draw, (1090, 35), "Silent demo", 16, GREY)
    return image, draw


def top_tag(draw, text="Illustrative replay · not a live recording", color=MINT):
    rounded(draw, (782, 82, 1224, 125), 20, "#34363F")
    draw.ellipse((802, 99, 812, 109), fill=color)
    fitted(draw, (824, 92), text, 380, 17, WHITE)


def subtitle(draw, time: float):
    rounded(draw, (40, 588, 1240, 685), 24, "#101216")
    draw.rectangle((64, 607, 68, 661), fill=MINT)
    current = next((item for item in CAPTIONS if item[0] <= time < item[1]), CAPTIONS[-1])
    start, end, words = current
    progress = ease((time - start) / min(1.2, end - start))
    count = max(1, math.ceil(len(words.split()) * progress))
    visible = " ".join(words.split()[:count])
    fitted(draw, (91, 613), visible, 1100, 29, WHITE, True)
    draw.rounded_rectangle((40, 703, 1240, 708), 2, fill="#4B4E55")
    draw.rounded_rectangle((40, 703, 40 + 1200 * time / DURATION, 708), 2, fill=MINT)


def title_scene(draw, time):
    label(draw, (72, 124), "Yoshida", 23, MINT, True)
    label(draw, (72, 170), "A cleaning request,", 63, WHITE, True)
    label(draw, (72, 243), "handled end to end.", 63, WHITE, True)
    label(draw, (74, 340), "A visual walkthrough of a previously verified fictional call.", 25, "#D1D3D8")
    top_tag(draw)
    for i, (name, description) in enumerate(
        [("01  Caller", "German browser call"), ("02  Handoff", "Tentative request"), ("03  Cleaner", "English review")]
    ):
        x = 73 + i * 392
        y = 444 + int((1 - ease((time - i * 0.25) / 0.7)) * 30)
        rounded(draw, (x, y, x + 350, y + 91), 19, "#303239")
        label(draw, (x + 22, y + 14), name, 22, MINT, True)
        label(draw, (x + 22, y + 49), description, 18, WHITE)


def waveform(draw, time, left=187, top=280, color=TEAL):
    for bar in range(33):
        height = 10 + int(27 * abs(math.sin(bar * 0.74 + time * 5)) * abs(math.sin(bar * 0.23 + time * 2)))
        x = left + bar * 12
        draw.rounded_rectangle((x, top - height, x + 6, top + height), 3, fill=color)


def caller_scene(draw, time):
    top_tag(draw)
    rounded(draw, (52, 100, 680, 559), 28, CREAM)
    label(draw, (87, 126), "yoshida", 29, TEAL, True)
    label(draw, (87, 182), "Eine Reinigung.", 43, "#193A40", True)
    label(draw, (87, 233), "Ein Gespräch.", 43, "#193A40", True)
    rounded(draw, (89, 331, 643, 518), 20, WHITE, "#D6E1E0", 2)
    draw.ellipse((114, 355, 185, 426), fill="#DAEEF0")
    draw.ellipse((138, 379, 160, 401), outline=TEAL, width=2)
    label(draw, (210, 359), "Im Gespräch", 26, "#193A40", True)
    waveform(draw, time, 210, 452)
    rounded(draw, (709, 150, 1227, 541), 23, "#303239")
    label(draw, (743, 181), "Request details", 27, WHITE, True)
    details = [
        ("Caller", BOOKING["caller"], 6),
        ("Date", BOOKING["date"], 13),
        ("Time", f'{BOOKING["time"]} · {BOOKING["city"]}', 16),
        ("Service", BOOKING["service"], 19),
        ("Address", BOOKING["address"], 19),
    ]
    for index, (heading, value, reveal) in enumerate(details):
        y = 245 + index * 57
        if time < reveal:
            draw.line((745, y + 32, 1188, y + 32), fill="#454851", width=2)
            continue
        label(draw, (745, y), heading, 17, "#AEB2BA")
        fitted(draw, (908, y - 3), value, 279, 20, WHITE, True)
        draw.line((745, y + 32, 1188, y + 32), fill="#454851", width=2)


def approval_scene(draw, time):
    top_tag(draw)
    label(draw, (68, 109), "The details are read back", 42, WHITE, True)
    label(draw, (70, 172), "Narrative summary · not a call transcript", 19, GREY)
    rounded(draw, (70, 244, 751, 506), 25, CREAM)
    label(draw, (109, 277), "Requested cleaning", 22, TEAL, True)
    label(draw, (109, 329), BOOKING["caller"], 32, INK, True)
    label(draw, (109, 384), f'{BOOKING["date"]} · {BOOKING["time"]} · {BOOKING["city"]}', 25, INK)
    label(draw, (109, 432), f'{BOOKING["address"]} · {BOOKING["duration"]}', 23, INK)
    if time >= 25:
        rounded(draw, (798, 260, 1208, 469), 25, "#D6EEE6")
        draw.ellipse((945, 277, 1059, 391), fill=TEAL)
        draw.line(((973, 336), (991, 354), (1031, 311)), fill=WHITE, width=9, joint="curve")
        label(draw, (872, 403), "Caller approved", 29, INK, True)
    else:
        rounded(draw, (798, 260, 1208, 469), 25, "#303239")
        label(draw, (845, 324), "Waiting for approval", 25, WHITE, True)


@lru_cache(maxsize=2)
def capture(name):
    return Image.open(MEDIA / name).convert("RGB")


def capture_scene(image, draw, time, name, heading, subheading):
    top_tag(draw, "App capture · copy of verified #40 data", LAVENDER)
    label(draw, (61, 106), heading, 39, WHITE, True)
    label(draw, (63, 164), subheading, 20, GREY)
    source = capture(name)
    if name == "caller-receipt.jpg":
        # The full capture establishes context; the second, direct crop makes
        # its tentative receipt legible without redrawing it as a fake UI.
        context = source.resize((585, 329), Image.Resampling.LANCZOS)
        image.paste(context, (64, 239))
        draw.rounded_rectangle((62, 237, 651, 570), 6, outline=LAVENDER, width=3)
        source = source.crop((665, 470, 1185, 660))
        w, h = 500, 183
        x, y = 708, 301
    else:
        source = source.crop((270, 275, 1245, 575))
        w = 1050 + int(18 * ease(time / 5))
        h = round(w * source.height / source.width)
        x, y = (WIDTH - w) // 2, 227
    resized = source.resize((w, h), Image.Resampling.LANCZOS)
    image.paste(resized, (x, y))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((x - 2, y - 2, x + w + 2, y + h + 2), 6, outline=LAVENDER, width=3)
    return draw


def review_scene(draw, time):
    top_tag(draw)
    label(draw, (64, 101), "Cleaner review", 42, WHITE, True)
    label(draw, (66, 160), "English dashboard · illustrative interaction", 19, GREY)
    rounded(draw, (68, 232, 1211, 539), 25, "#F7F6FA")
    rounded(draw, (97, 260, 1181, 326), 17, "#E4D9FC")
    label(draw, (121, 277), "Needs review", 27, INK, True)
    rounded(draw, (97, 347, 1181, 508), 14, WHITE)
    draw.ellipse((119, 381, 173, 435), fill="#EDEAF3")
    label(draw, (135, 391), "TB", 18, INK, True)
    label(draw, (196, 369), BOOKING["caller"], 26, INK, True)
    label(draw, (196, 413), f'{BOOKING["address"]} · {BOOKING["city"]}', 18, "#64656D")
    label(draw, (574, 370), BOOKING["date"], 22, INK, True)
    label(draw, (574, 412), BOOKING["time"], 18, "#64656D")
    label(draw, (820, 370), BOOKING["service"], 22, INK, True)
    label(draw, (820, 412), "Budget not given", 18, "#64656D")
    if time >= 42:
        rounded(draw, (982, 448, 1155, 493), 20, "#C8E8DF")
        label(draw, (1009, 455), "Confirmed", 20, INK, True)
    else:
        rounded(draw, (982, 448, 1155, 493), 20, "#75618D")
        label(draw, (1017, 455), "Confirm", 20, WHITE, True)
        if time >= 40:
            draw.ellipse((1090, 477, 1111, 498), fill=MINT, outline=INK, width=2)


def closing_scene(draw):
    top_tag(draw)
    label(draw, (84, 152), "A local prototype with a clear handoff.", 48, WHITE, True)
    label(draw, (86, 235), "German caller  /  tentative request  /  English cleaner decision", 25, MINT)
    rounded(draw, (83, 334, 1200, 485), 25, "#303239")
    label(draw, (120, 365), "No voice or call recording in this video.", 27, WHITE, True)
    label(draw, (120, 416), "Illustrative motion uses fictional data from a verified prior local run.", 21, "#D2D4D9")


def frame(time: float) -> Image.Image:
    image, draw = base()
    if time < 5:
        title_scene(draw, time)
    elif time < 21:
        caller_scene(draw, time)
    elif time < 30:
        approval_scene(draw, time)
    elif time < 37:
        draw = capture_scene(image, draw, time - 30, "caller-receipt.jpg", "Saved as tentative", "Receipt shown in a disposable copy of the #40 call data")
    elif time < 46:
        review_scene(draw, time)
    elif time < 52:
        draw = capture_scene(image, draw, time - 46, "cleaner-confirmed.jpg", "Confirmed in Upcoming", "Persisted owner decision shown in a disposable data copy")
    else:
        closing_scene(draw)
    subtitle(draw, time)
    return image


def timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int(seconds // 60) % 60
    remaining = seconds % 60
    return f"{hours:02}:{minutes:02}:{remaining:06.3f}"


def write_captions(path: Path):
    lines = ["WEBVTT", ""]
    for start, end, words in CAPTIONS:
        lines.extend([f"{timestamp(start)} --> {timestamp(end)}", words, ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def render_video(path: Path):
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(path),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for number in range(FPS * DURATION):
            process.stdin.write(frame(number / FPS).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed to render showcase video")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=float, help="Render one PNG frame at this second")
    args = parser.parse_args()
    if args.preview is not None:
        frame(args.preview).save(Path("/tmp/yoshida-showcase-preview.png"))
        print("/tmp/yoshida-showcase-preview.png")
        return
    write_captions(MEDIA / "yoshida-silent-demo.vtt")
    render_video(MEDIA / "yoshida-silent-demo.mp4")


if __name__ == "__main__":
    main()
