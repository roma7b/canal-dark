"""Sound for sims/fimdomundo, keyed to the narration word timings.

    python3 -m sfx sfx/cues/fimdomundo.py
"""
import json
import unicodedata

from sfx.synth import blip, chime, click, envelope, impact, pad, pop, riser, whoosh

TIMELINE = "sims/fimdomundo/timeline.json"
OUT = "out/fimdomundo/sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/fimdomundo/narracao-fit-words.json", encoding="utf-8"))
LINES = {}
for w in WORDS:
    LINES.setdefault(w["line"], []).append(w)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if c.isalnum() and c.isascii())


def W(n, p, k=0):
    p = norm(p)
    return [w["a"] for w in LINES[n] if norm(w["w"]).startswith(p)][k]


def L(n):
    return LINES[n][0]["a"], LINES[n][-1]["b"]


DM = [73.42, 110.0, 146.83, 174.61, 220.0]
FM = [87.31, 130.81, 174.61, 220.0, 261.63]
CM = [130.81, 196.0, 261.63, 329.63, 392.0]


def score(mix, tl):
    dur = tl["duration"]
    put = mix.put
    vol = envelope([(0, 0.8), (0.8, 1), (dur - 1, 1), (dur, 0)])
    mix.put_stereo(0, *pad(dur, [(0, DM), (L(3)[0], FM), (L(8)[0], DM), (L(11)[0], CM)], volume=vol), gain=0.032)
    cuts = [L(1)[0], W(1, "foram"), L(2)[0], L(3)[0], L(4)[0], W(4, "nesse"), L(5)[0], L(6)[0], L(7)[0], W(7, "ele"), L(8)[0], L(9)[0], L(10)[0], L(11)[0], L(12)[0]]
    for i, c in enumerate(cuts):
        put(c - 0.16, whoosh(0.28, 2200, 600, peak=0.4), 0.1, -0.3 if i % 2 else 0.3)
    put(W(0, "ontem"), impact(1.0), 0.3)
    put(W(1, "nao") - 0.05, blip(220.0, dur=0.3, tau=0.08), 0.2)
    put(W(2, "dia") - 0.05, impact(0.7), 0.22)
    beats = [W(4, "gente", 0), W(4, "gente", 1), W(4, "gente", 2), W(4, "ainda"), W(4, "mais", 2)]
    for i, b in enumerate(beats):
        put(b, pop(500 + i * 120, 900 + i * 150), 0.18)
    put(W(4, "nesse"), riser(W(4, "infinito") - W(4, "nesse") + 0.3, f0=200, f1=4000), 0.1)
    put(W(4, "infinito") + 0.3, impact(0.8), 0.25)
    put(W(5, "sexta") - 0.05, click(900, dur=0.08), 0.3)
    put(L(6)[0] - 0.1, pop(400, 900, dur=0.2), 0.3)
    put(W(7, "aniversario"), chime([523.25, 659.25, 783.99], dur=1.4, tau=0.5), 0.12)
    put(W(9, "devagar"), whoosh(0.8, 1800, 300, peak=0.3), 0.1)
    put(W(10, "oito"), riser(1.2, f0=400, f1=2400), 0.07)
    put(W(11, "acabou"), impact(0.7), 0.25)
    put(W(11, "formula"), click(500, dur=0.1), 0.35)
    put(L(12)[0], chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.14)
