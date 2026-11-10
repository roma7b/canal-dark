"""Sound for sims/loteria, keyed to the narration's word timings.

    python3 -m sfx sfx/cues/loteria.py
"""
import json
import math
import random
import unicodedata

from sfx.synth import SR, bandnoise, blip, chime, click, envelope, impact, pad, pop, riser, whoosh

TIMELINE = "sims/loteria/timeline.json"
OUT = "out/sims/loteria-sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/loteria/narracao-fit-words.json", encoding="utf-8"))
LINES = {}
for w in WORDS:
    LINES.setdefault(w["line"], []).append(w)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if c.isalpha() and c.isascii())


def W(n, prefix):
    p = norm(prefix)
    return next(w["a"] for w in LINES[n] if norm(w["w"]).startswith(p))


def L(n):
    return LINES[n][0]["a"], LINES[n][-1]["b"]


# C major-ish, playful
BED_A = [130.81, 196.0, 261.63, 329.63, 392.0]
BED_B = [110.0, 164.81, 220.0, 261.63, 329.63]  # A minor for the tension part
BED_C = [146.83, 220.0, 293.66, 349.23, 440.0]


def drumroll(dur, seed=4):
    random.seed(seed)
    n = int(dur * SR)
    out = []
    for k in range(n):
        u = k / n
        hit = math.exp(-((k / SR) % 0.045) / 0.012)
        out.append(random.uniform(-1, 1) * hit * (0.35 + 0.65 * u))
    return out


def score(mix, tl):
    dur = tl["duration"]
    put = mix.put
    t_corr, _ = L(7)
    _, t_end7 = L(7)
    t_saiu, _ = L(8)
    vol = envelope([(0, 0.8), (1, 1), (t_corr, 1), (t_corr + 0.3, 0.8), (t_saiu, 0.8), (t_saiu + 0.3, 1.1), (dur - 1, 1.1), (dur, 0)])
    mix.put_stereo(0, *pad(dur, [(0, BED_A), (L(5)[0], BED_C), (t_corr, BED_B), (t_saiu, BED_A)], volume=vol), gain=0.03)

    # shot cuts: a soft whoosh on every new scene
    starts = [0.0] + [L(n)[0] - 0.12 for n in (1, 2, 3, 4, 5, 6, 7, 9, 10)] + [t_end7 + 0.15]
    for i, s in enumerate(starts[1:]):
        put(s - 0.08, whoosh(0.35, 1800, 500, peak=0.4), 0.10, 0.3 if i % 2 else -0.3)

    # hook: 14 trophies pop in
    t14 = W(0, "catorze")
    for k in range(14):
        put(t14 - 0.6 + k * 0.07, pop(700 + k * 40, 300), 0.10, -0.4 + k * 0.06)
    put(t14 + 0.4, chime([523.25, 659.25, 783.99], dur=1.4, tau=0.5), 0.10)

    # chalkboard: cross out "sorte", write "conta"
    put(W(1, "sorte") + 0.35, whoosh(0.4, 3000, 900, peak=0.3, q=0.5), 0.12)
    put(W(1, "conta"), blip(783.99, dur=0.4, tau=0.1), 0.18)

    # raffle: ticks while he marks the numbers
    a, b = W(2, "compra"), L(2)[1] + 0.4
    t = a
    i = 0
    while t < b:
        put(t, click(2000 + (i % 5) * 120, dur=0.03), 0.08, -0.2 + (i % 3) * 0.2)
        t += 0.07
        i += 1
    put(L(3)[0] - 0.1, pop(400, 900, dur=0.2), 0.3)  # "Peraí"

    # scale tips, "é compra" stamp
    put(W(4, "maior") - 0.05, whoosh(0.5, 400, 1400, peak=0.6), 0.15)
    put(L(4)[1] - 0.55, impact(0.7), 0.25)

    # Australia: investors pop, 12 trophies, rules slam
    put(W(5, "investidores") - 0.1, pop(600, 300), 0.2)
    for k in range(12):
        put(W(5, "doze") - 0.2 + k * 0.09, pop(800 + k * 30, 350), 0.08)
    put(W(5, "mudar") - 0.15, whoosh(0.3, 2500, 300, peak=0.8), 0.15)
    put(W(5, "mudar") + 0.15, impact(0.9), 0.35)

    # Virginia: numbers light up, prize counter
    put(W(6, "sete") - 0.05, blip(523.25, dur=0.35), 0.15)
    put(W(6, "dolar") - 0.05, blip(659.25, dur=0.35), 0.15)
    tv = W(6, "vinte")
    put(tv - 0.6, riser(1.7, f0=300, f1=3000), 0.08)
    for k in range(14):
        put(tv + k * 0.08, click(1500 + k * 60, dur=0.03), 0.07)
    put(tv + 1.1, chime([523.25, 783.99, 1046.5], dur=1.6, tau=0.6), 0.12)

    # the run: clock ticks, alarm on "faltaram"
    t = t_corr
    while t < t_end7:
        put(t, click(900, dur=0.04), 0.10)
        t += 0.5
    put(W(7, "faltaram") - 0.05, blip(220.0, dur=0.3, tau=0.08), 0.25)
    put(W(7, "faltaram") + 0.25, blip(220.0, dur=0.3, tau=0.08), 0.25)

    # the draw: drum roll in the pause, hit on "Saiu"
    put(t_end7 + 0.1, drumroll(t_saiu - t_end7 + 0.1), 0.25)
    put(t_saiu, impact(1.0), 0.35)
    put(t_saiu + 0.4, chime([523.25, 659.25, 783.99, 1046.5], dur=2.0, tau=0.7), 0.16)

    # investigation: stamp, then the rule change
    put(W(9, "lei") - 0.05, impact(0.6), 0.3)
    put(W(9, "hoje") - 0.05, whoosh(0.35, 2500, 400, peak=0.7), 0.12)
    put(W(9, "hoje") + 0.1, click(500, dur=0.08), 0.3)

    # ending: pull back over the mountain of tickets
    te = W(10, "ele")
    put(te - 0.2, whoosh(1.6, 300, 2400, peak=0.5), 0.14)
    put(te + 1.1, chime([523.25, 659.25, 783.99, 1046.5, 1318.5], dur=2.4, tau=0.9), 0.14)
