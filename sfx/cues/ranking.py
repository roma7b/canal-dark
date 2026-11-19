"""Sound for sims/ranking (Vai Bem, visto mais pedido): bright bed, whooshes on cuts, a fanfare on the first place.

    python3 -m sfx sfx/cues/ranking.py
"""
import json
import unicodedata

from sfx.synth import blip, chime, click, envelope, pad, pop, whoosh

TIMELINE = "sims/ranking/timeline.json"
OUT = "out/ranking/sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/ranking/narracao-fit-words.json", encoding="utf-8"))
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
    mix.put_stereo(0, *pad(dur, [(0, AMIN), (L(2)[0], CMAJ), (L(4)[0], FMAJ), (L(6)[0], CMAJ), (L(10)[0], FMAJ), (L(13)[0], CMAJ)], volume=vol), gain=0.03)

    cuts = []
    for i, (sid, line, word) in enumerate(tl["shots"]):
        if i == 0:
            continue
        cuts.append(W(line, word) - 0.08 if word else L(line)[0] - 0.1)
    for i, c in enumerate(cuts):
        put(c - 0.06, whoosh(0.22, 2600, 700, peak=0.35), 0.11, -0.3 if i % 2 else 0.3)
        put(c, click(1800 + (i % 4) * 150, dur=0.03), 0.10)

    put(W(0, "suspenso"), blip(300, dur=0.3, tau=0.08), 0.18)
    for n, w in [(0, "mais"), (1, "tres"), (2, "nomade"), (2, "quatro"), (2, "2026"), (3, "aposentados"), (4, "estudo"), (4, "aceito"), (5, "ano"), (5, "profissionalizante"), (8, "contrato"), (8, "promessa"), (9, "empresas"), (9, "indicacao"), (10, "unicos"), (12, "visto"), (12, "documentos"), (12, "passagem"), (12, "direct")]:
        put(W(n, w), pop(700, 1100, dur=0.16), 0.16)
    put(L(6)[0], chime([523.25, 659.25, 783.99, 1046.5], dur=1.6, tau=0.5), 0.15)
    put(W(7, "vistos"), chime([783.99, 1046.5], dur=0.8, tau=0.3), 0.12)
    put(L(13)[0], chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.14)
