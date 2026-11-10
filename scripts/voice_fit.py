"""Speed up a narration and add pauses before given lines, keeping word timings in sync.

    python3 scripts/voice_fit.py sims/loteria --speed 1.1 --pause 3=0.25 --pause 8=0.8

Reads <dir>/narracao.mp3 + narracao-words.json, writes <dir>/narracao-fit.wav and
narracao-fit-words.json. Pitch is preserved (ffmpeg atempo).
"""
import argparse
import json
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("dir")
ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--pause", action="append", default=[], help="LINE=SECONDS of silence inserted before that line")
a = ap.parse_args()
d = Path(a.dir)
words = json.loads((d / "narracao-words.json").read_text(encoding="utf-8"))
pauses = {int(k): float(v) for k, v in (p.split("=") for p in a.pause)}

# cut points: the gap midpoint before each paused line (original timeline)
cuts = []
for line, sec in sorted(pauses.items()):
    first = next(w for w in words if w["line"] == line)
    prev = max((w for w in words if w["line"] < line), key=lambda w: w["b"])
    cuts.append(((prev["b"] + first["a"]) / 2, sec))

# filter graph: split into segments, add silence between them, then atempo
src = str(d / "narracao.mp3")
edges = [0.0] + [c for c, _ in cuts] + [None]
parts, labels = [], []
for i in range(len(edges) - 1):
    t0, t1 = edges[i], edges[i + 1]
    trim = f"atrim=start={t0}" + (f":end={t1}" if t1 is not None else "")
    parts.append(f"[0:a]{trim},asetpts=PTS-STARTPTS[s{i}]")
    labels.append(f"[s{i}]")
    if i < len(cuts):
        parts.append(f"anullsrc=r=44100:cl=mono,atrim=duration={cuts[i][1]}[z{i}]")
        labels.append(f"[z{i}]")
graph = ";".join(parts) + f";{''.join(labels)}concat=n={len(labels)}:v=0:a=1,atempo={a.speed}[out]"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-filter_complex", graph, "-map", "[out]", "-ac", "1", "-ar", "48000", str(d / "narracao-fit.wav")], check=True)

def remap(t):
    shift = sum(sec for c, sec in cuts if t > c)
    return round((t + shift) / a.speed, 3)

fit = [{**w, "a": remap(w["a"]), "b": remap(w["b"])} for w in words]
(d / "narracao-fit-words.json").write_text(json.dumps(fit, ensure_ascii=False, indent=0), encoding="utf-8")
print(f"{fit[-1]['b']:.2f} s")
