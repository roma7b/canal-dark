"""Sound for sims/fases (Vai Bem, 3 fases): light bed that darkens in the crisis, whooshes on cuts, pops for labels.

    python3 -m sfx sfx/cues/fases.py
"""
import json
import unicodedata

from sfx.synth import blip, chime, click, envelope, pad, pop, whoosh

TIMELINE = "sims/fases/timeline.json"
OUT = "out/fases/sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/fases/narracao-fit-words.json", encoding="utf-8"))
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
    # bright honeymoon, minor crisis, warm adaptation
    mix.put_stereo(0, *pad(dur, [(0, CMAJ), (L(4)[0], AMIN), (L(7)[0], FMAJ), (L(10)[0], CMAJ), (L(12)[0], FMAJ), (L(14)[0], CMAJ)], volume=vol), gain=0.03)

    cuts = []
    for i, (sid, line, word) in enumerate(tl["shots"]):
        if i == 0:
            continue
        cuts.append(W(line, word) - 0.08 if word else L(line)[0] - 0.1)
    for i, c in enumerate(cuts):
        put(c - 0.06, whoosh(0.22, 2600, 700, peak=0.35), 0.11, -0.3 if i % 2 else 0.3)
        put(c, click(1800 + (i % 4) * 150, dur=0.03), 0.10)

    for n, w, f in [(2, "aventura", 330), (5, "dificil", 300), (6, "desiste", 280)]:
        put(W(n, w), blip(f, dur=0.3, tau=0.08), 0.18)
    for k, n in enumerate([2, 4, 7]):
        put(L(n)[0], chime([523.25 * 2 ** (k * 2 / 12), 783.99 * 2 ** (k * 2 / 12)], dur=0.9, tau=0.3), 0.12)
    for n, w in [(1, "passa"), (3, "foto"), (3, "prova"), (3, "conto"), (5, "saudade"), (7, "meses"), (8, "rotina"), (8, "documentos"), (8, "trabalho"), (11, "certo"), (13, "visto"), (13, "documentos"), (13, "passagem"), (13, "direct")]:
        put(W(n, w), pop(700, 1100, dur=0.16), 0.16)
    put(W(10, "consegui"), chime([523.25, 659.25, 783.99, 1046.5], dur=1.6, tau=0.5), 0.14)
    put(L(14)[0], chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.14)
