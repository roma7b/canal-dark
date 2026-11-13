"""Narration via the ElevenLabs API, with word timings.

    python3 scripts/tts.py sims/loteria

Reads the text block of <dir>/narracao.md (the first ``` block), calls
text-to-speech with-timestamps, and writes <dir>/narracao.mp3 plus
<dir>/narracao-words.json: [{"w": word, "a": start_s, "b": end_s, "line": n}].

The API key is never read here: the session's network proxy adds it to
requests for api.elevenlabs.io. Locally, set ELEVEN_API_KEY instead.
"""

import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path

VOICE = os.environ.get("ELEVEN_VOICE", "4XmhZ74tBbUVCXIYNMMo")  # default: Leonardo (pt-BR). Vai Bem uses Jenifer: GOkMqfyKMLVUcYfO2WbB (stability 0.5, style 0.15)
MODEL = "eleven_multilingual_v2"
SETTINGS = {
    "stability": float(os.environ.get("ELEVEN_STABILITY", 0.45)),
    "similarity_boost": 0.75,
    "style": float(os.environ.get("ELEVEN_STYLE", 0.15)),
    "use_speaker_boost": True,
    "speed": float(os.environ.get("ELEVEN_SPEED", 1.05)),
}


def read_text(md):
    m = re.search(r"```\n(.*?)```", md.read_text(encoding="utf-8"), re.S)
    if not m:
        sys.exit(f"no ``` block in {md}")
    return "\n".join(l.strip() for l in m.group(1).strip().splitlines() if l.strip())


def words_from_alignment(text, al):
    chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    out, cur, line = [], None, 0
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                out.append(cur)
                cur = None
            if ch == "\n":
                line += 1
            continue
        if cur is None:
            cur = {"w": ch, "a": round(a, 3), "b": round(b, 3), "line": line}
        else:
            cur["w"] += ch
            cur["b"] = round(b, 3)
    if cur:
        out.append(cur)
    return out


SR = 44100
GAP = 0.22  # silence between lines, seconds


def call(payload, fmt):
    cmd = ["curl", "-sS", "-m", "180", "-X", "POST",
           f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format={fmt}",
           "-H", "Content-Type: application/json", "--data-binary", "@-"]
    if os.environ.get("ELEVEN_API_KEY"):
        cmd[4:4] = ["-H", f"xi-api-key: {os.environ['ELEVEN_API_KEY']}"]
    res = subprocess.run(cmd, input=json.dumps(payload).encode(), capture_output=True, check=True)
    data = json.loads(res.stdout)
    if "audio_base64" not in data:
        sys.exit(f"API error: {json.dumps(data)[:400]}")
    return data


def main():
    d = Path(sys.argv[1])
    text = read_text(d / "narracao.md")
    lines = text.split("\n")
    if os.environ.get("ELEVEN_MODE", "lines") == "full":
        # whole script in one request: most natural flow, but long texts can drift at the end
        data = call({"text": text, "model_id": MODEL, "voice_settings": SETTINGS, "language_code": "pt", "seed": 7}, "mp3_44100_128")
        (d / "narracao.mp3").write_bytes(base64.b64decode(data["audio_base64"]))
        words = words_from_alignment(text, data["alignment"])
        (d / "narracao-words.json").write_text(json.dumps(words, ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"{len(text)} chars, {len(words)} words, {words[-1]['b']:.2f} s -> {d}/narracao.mp3 (full)")
        return
    # One request per line, with the neighbouring lines as context: long single
    # generations drift and turn robotic towards the end; short ones stay natural.
    pcm, words = bytearray(), []
    for i, line in enumerate(lines):
        payload = {"text": line, "model_id": MODEL, "voice_settings": SETTINGS, "language_code": "pt", "seed": 7}
        if i > 0:
            payload["previous_text"] = lines[i - 1]
        if i + 1 < len(lines):
            payload["next_text"] = lines[i + 1]
        data = call(payload, "mp3_44100_128")
        off = len(pcm) / 2 / SR
        for w in words_from_alignment(line, data["alignment"]):
            words.append({**w, "a": round(w["a"] + off, 3), "b": round(w["b"] + off, 3), "line": i})
        dec = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "mp3", "-i", "pipe:0", "-f", "s16le", "-ar", str(SR), "-ac", "1", "pipe:1"],
                             input=base64.b64decode(data["audio_base64"]), capture_output=True, check=True)
        pcm += dec.stdout
        if i + 1 < len(lines):
            pcm += bytes(int(GAP * SR) * 2)
        print(f"  line {i}: {len(line)} chars")
    raw = d / "narracao.pcm"
    raw.write_bytes(pcm)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", str(raw),
                    "-b:a", "192k", str(d / "narracao.mp3")], check=True)
    raw.unlink()
    (d / "narracao-words.json").write_text(json.dumps(words, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(text)} chars, {len(words)} words, {words[-1]['b']:.2f} s -> {d}/narracao.mp3")


if __name__ == "__main__":
    main()
