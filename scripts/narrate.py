"""Generate the demo-video narration with edge-tts (synthetic voice).

Usage:
  python scripts/narrate.py                       # all lines, default voice
  python scripts/narrate.py --voice en-US-BrianNeural --only VO-S01-L01 VO-S04-L02 --out video/narration/samples/brian

Needs `pip install edge-tts` and ffmpeg on PATH. Sends the script text to Microsoft's
speech service. Output: one MP3 per line id plus durations.txt.
"""
import argparse
import asyncio
import json
import pathlib
import subprocess
import tempfile

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINES = ROOT / "video" / "narration" / "lines.json"


async def speak(text: str, voice: str, rate: str, path: pathlib.Path) -> None:
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(path))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 3:
                raise
            await asyncio.sleep(2 * (attempt + 1))


def silence(seconds: float, path: pathlib.Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
         "anullsrc=r=24000:cl=mono", "-t", str(seconds), "-c:a", "libmp3lame", str(path)],
        check=True,
    )


def duration(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


async def render(line_id: str, parts: list, voice: str, rate: str, out_dir: pathlib.Path) -> float:
    target = out_dir / f"{line_id}.mp3"
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = pathlib.Path(tmp)
        pieces = []
        for i, part in enumerate(parts):
            piece = tmp_dir / f"{i:02d}.mp3"
            if isinstance(part, (int, float)):
                silence(part, piece)
            else:
                await speak(part, voice, rate, piece)
            pieces.append(piece)
        listing = tmp_dir / "list.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in pieces))
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
             "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", str(target)],
            check=True,
        )
    return duration(target)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="en-US-AndrewNeural")
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--out", default="video/narration/audio")
    args = parser.parse_args()

    lines = json.loads(LINES.read_text(encoding="utf-8"))["lines"]
    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    report = []
    for line_id, parts in lines.items():
        if args.only and line_id not in args.only:
            continue
        seconds = await render(line_id, parts, args.voice, args.rate, out_dir)
        report.append(f"{line_id}\t{seconds:.1f}s")
        print(report[-1])
    (out_dir / "durations.txt").write_text(
        f"voice {args.voice} rate {args.rate}\n" + "\n".join(report) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    asyncio.run(main())
