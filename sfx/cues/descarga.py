"""Sound for sims/descarga. Every time comes from its timeline.json.

    python3 -m sfx sfx/cues/descarga.py
"""
import math
import random

from sfx.synth import SR, bandnoise, blip, chime, click, envelope, pad, pop, whoosh

TIMELINE = "sims/descarga/timeline.json"
OUT = "out/sims/descarga.wav"
TARGET_LUFS = -14.0

# A minor-ish bed, light and curious
BED_A = [110.0, 220.0, 261.63, 329.63, 493.88]
BED_B = [87.31, 174.61, 261.63, 349.23, 440.0]


def water(dur, f_lo, f_hi, swell, seed):
    """Running water: two band-passed noises with a slow wobble. swell(k01) -> gain."""
    random.seed(seed)
    n = int(dur * SR)
    a = bandnoise(n, lambda k: f_lo + 300 * math.sin(k / SR * 7.3) ** 2, q=0.6)
    b = bandnoise(n, lambda k: f_hi + 900 * math.sin(k / SR * 3.1 + 1) ** 2, q=1.2)
    out = []
    for k in range(n):
        u = k / n
        g = swell(u) * min(1, k / (0.05 * SR)) * min(1, (n - k) / (0.15 * SR))
        out.append((a[k] * 0.9 + b[k] * 0.35) * g)
    return out


def score(mix, tl):
    dur = tl["duration"]
    put = mix.put
    vol = envelope([(0, 0.6), (1.0, 1), (tl["fail"], 1), (tl["fail"] + 0.3, 0.7), (tl["outro"], 1.1), (dur - 0.6, 1.1), (dur, 0)])
    mix.put_stereo(0, *pad(dur, [(0, BED_A), (tl["fail"], BED_B), (tl["outro"], BED_A)], volume=vol), gain=0.03)

    # hook + caption pops
    for i, (a, _b, _txt) in enumerate(tl["captions"]):
        if a > 0:
            put(a, pop(700 + 60 * (i % 4), 300), 0.10, 0.2 * ((i % 3) - 1))

    # x-ray scan down, and back up at the end
    put(tl["scanStart"], whoosh(tl["scanEnd"] - tl["scanStart"], 2400, 500, peak=0.4), 0.22)
    put(tl["scanEnd"] - 0.1, chime([880.0, 1318.5, 1760.0], dur=1.4, tau=0.5), 0.07)
    put(tl["scanBack"], whoosh(tl["scanBackEnd"] - tl["scanBack"], 500, 2400, peak=0.6), 0.18)

    # button + gate
    put(tl["press"], click(1400), 0.45)
    put(tl["press"] + 0.03, click(900, dur=0.08), 0.3)
    # flush: a big rush that fades as the tank empties
    d = tl["drainEnd"] - tl["drainStart"] + 0.6
    put(tl["drainStart"] - 0.1, water(d, 380, 1600, lambda u: 1.0 - 0.75 * u, 3), 0.55)
    put(tl["gateClose"] + 0.35, click(700, dur=0.09), 0.35)

    # refill: steady trickle, getting softer as the float rises
    d = tl["refillEnd"] - tl["refillStart"] + 0.3
    put(tl["refillStart"] - 0.4, water(d + 0.4, 900, 2600, lambda u: 0.55 * (1 - u) ** 0.6 + 0.05, 5), 0.32)
    put(tl["valveShut"], click(2200), 0.4)
    put(tl["valveShut"] + 0.05, chime([659.25, 987.77, 1318.5], dur=1.6, tau=0.55), 0.10)

    # failure: warning blips, water rising, then the overflow gurgle
    for i in range(3):
        put(tl["fail"] + 0.05 + i * 0.22, blip(392.0 if i < 2 else 330.0, dur=0.25, tau=0.07), 0.2)
    d = tl["overflowEnd"] - tl["fail"]
    put(tl["fail"] + 0.2, water(d, 1100, 2900, lambda u: 0.45, 7), 0.28)
    put(tl["riseEnd"] - 0.1, water(tl["overflowEnd"] - tl["riseEnd"] + 0.2, 300, 900, lambda u: 0.9, 9), 0.35, 0.3)

    # payoff
    put(tl["outro"] + 0.05, chime([523.25, 659.25, 783.99, 1046.5], dur=2.2, tau=0.8), 0.14)
