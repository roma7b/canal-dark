"""Sound for sims/estudo (Vai Bem, checklist do visto de estudo): bright bed, whooshes on cuts, a tick for every checklist item.

    python3 -m sfx sfx/cues/estudo.py
"""
import json
import unicodedata

from sfx.synth import blip, chime, click, envelope, pad, pop, whoosh

TIMELINE = "sims/estudo/timeline.json"
OUT = "out/estudo/sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/estudo/narracao-fit-words.json", encoding="utf-8"))
LINES = {}
for w in WORDS:
    LINES.setdefault(w["line"], []).append(w)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if c.isalnum() and c.isascii())


def W(n, prefix):
    p = norm(prefix)
    return next(w["a"] for w in LINES[n] if norm(w["w"]).startswith(p))


def L(n):
    return LINES[n][0]["a"], LINES[n][-1]["b"]


CMAJ = [130.81, 196.0, 261.63, 329.63, 392.0]
AMIN = [110.0, 164.81, 220.0, 261.63, 329.63]
FMAJ = [87.31, 174.61, 220.0, 261.63, 349.23]


def score(mix, tl):
    dur = tl["duration"]
    put = mix.put
    vol = envelope([(0, 0.8), (0.6, 1), (dur - 1.0, 1), (dur, 0)])
    mix.put_stereo(0, *pad(dur, [(0, CMAJ), (L(3)[0], FMAJ), (L(6)[0], CMAJ), (L(8)[0], AMIN), (L(10)[0], FMAJ), (L(13)[0], CMAJ), (L(15)[0], FMAJ)], volume=vol), gain=0.03)

    cuts = []
    for i, (sid, line, word) in enumerate(tl["shots"]):
        if i == 0:
            continue
        cuts.append(W(line, word) - 0.08 if word else L(line)[0] - 0.1)
    for i, c in enumerate(cuts):
        put(c - 0.06, whoosh(0.22, 2600, 700, peak=0.35), 0.11, -0.3 if i % 2 else 0.3)
        put(c, click(1800 + (i % 4) * 150, dur=0.03), 0.10)

    for n, w, f in [(5, "comprovativo", 300), (7, "trinta", 320)]:
        put(W(n, w), blip(f, dur=0.3, tau=0.08), 0.18)
    for n, w in [(0, "checklist"), (1, "oficial"), (2, "longa"), (2, "documentos"), (3, "quatro"), (4, "tres"), (5, "precisa"), (6, "graca"), (7, "final"), (8, "curso"), (9, "onde"), (10, "matricula"), (11, "dgert"), (11, "ano"), (12, "outros"), (14, "visto"), (14, "documentos"), (14, "passagem"), (14, "direct")]:
        put(W(n, w), pop(700, 1100, dur=0.16), 0.16)
    put(L(15)[0], chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.14)
