# Narration (synthetic voice)

Generated with `edge-tts` (Microsoft neural voices) from `lines.json`, which holds the
speech-ready lines of `docs/VIDEO.md` section 5. Disclose in the YouTube and Devpost
descriptions: "Narration uses a synthetic (AI-generated) voice."

- `audio/`: one MP3 per line id, voice `en-US-BrianNeural` (chosen 14 Nov), normal rate.
  `audio/durations.txt` lists the lengths.
- `samples/sample-<voice>.mp3`: VO-S01-L01 then VO-S04-L02 in four voices (andrew,
  brian, christopher, ava) to choose by ear.

Regenerate (needs `pip install edge-tts` and ffmpeg; sends the text to Microsoft):

```bash
python scripts/narrate.py            # Brian, the chosen voice
python scripts/narrate.py --rate -5%  # slower
```

A number inside a line in `lines.json` is a pause in seconds. PAY keys are written as
"pay one", MCP and LLMs as spaced letters, so the voice reads them correctly.

## Fit against the storyboard (Brian, 14 Nov)

| Line | Planned | Actual | Slot |
|---|---|---|---|
| VO-S01-L01 | ~13 s | 13.3 s | S01 20 s |
| VO-S02-L01 | ~11 s | 10.9 s | S02 15 s |
| VO-S03-L01 | ~16 s | 14.3 s | S03 25 s |
| VO-S04-L01 | ~9 s | 7.0 s | S04 0-12 s |
| VO-S04-L02 | ~15 s | 12.6 s | S04 12-30 s |
| VO-S04-L03 | ~16 s | 13.1 s | S04 30-55 s |
| VO-S05-L01 | ~12 s | 10.6 s | S05 0-14 s |
| VO-S05-L02 | ~10 s | 4.2 s | S05 14-26 s |
| VO-S05-L03 | ~10 s | 7.4 s | S05 26-40 s |
| VO-S06-L01 | ~16 s | 12.2 s | S06 25 s |
| VO-S07-L01 | ~15 s | 11.0 s | S07 25 s |
| VO-S08-L01 | ~15 s | 13.0 s | S08 25 s |
| VO-S09-L01 | ~15 s | 12.6 s | S09 25 s |
| VO-S10-L01 | ~13 s | 11.3 s | S10 17 s |
| VO-S11-L01 | ~10.5 s | 11.8 s | S11 13 s |

Every line fits its slot. Total narration 175 s in a 4:45 video; the editor can trim
holds where a line ends early.
