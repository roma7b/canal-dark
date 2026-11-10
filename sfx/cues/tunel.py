"""Sound for sims/tunel (Você Decide: O Túnel, ep 1), keyed to the narration timings.

    python3 -m sfx sfx/cues/tunel.py
"""
import json
import math
import random
import unicodedata

from sfx.synth import SR, bandnoise, blip, chime, click, envelope, impact, pad, pop, riser, whoosh

TIMELINE = "sims/tunel/timeline.json"
OUT = "out/tunel/ep1-sfx.wav"
TARGET_LUFS = -14.0

WORDS = json.load(open("sims/tunel/narracao-fit-words.json", encoding="utf-8"))
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


# D minor, low and tense
DM = [73.42, 110.0, 146.83, 174.61, 220.0]
BB = [58.27, 116.54, 146.83, 174.61, 233.08]
GM = [98.0, 146.83, 196.0, 233.08, 293.66]


def static(dur, seed=3):
    random.seed(seed)
    n = int(dur * SR)
    a = bandnoise(n, lambda k: 2400 + 1400 * math.sin(k / SR * 9) ** 2, q=0.5)
    return [a[k] * (0.6 + 0.4 * math.sin(k / SR * 31) ** 2) * min(1, k / 2000) * min(1, (n - k) / 4000) for k in range(n)]


def heartbeat():
    out = []
    for k in range(int(0.45 * SR)):
        tt = k / SR
        s = math.sin(2 * math.pi * 52 * tt) * math.exp(-tt / 0.05)
        if tt > 0.18:
            s += 0.7 * math.sin(2 * math.pi * 48 * (tt - 0.18)) * math.exp(-(tt - 0.18) / 0.05)
        out.append(s)
    return out


def score(mix, tl):
    dur = tl["duration"]
    put = mix.put
    t8 = L(8)[0]
    t11 = L(11)[0]
    vol = envelope([(0, 0.7), (1, 1), (t8, 1), (t8 + 0.4, 1.2), (dur - 1.2, 1.2), (dur, 0)])
    mix.put_stereo(0, *pad(dur, [(0, DM), (L(4)[0], BB), (t8, GM), (t11, DM)], volume=vol, detune=0.4, tremolo=0.15), gain=0.035)

    # hook: money counter ticks up
    tt = W(0, "toneladas")
    for k in range(18):
        put(tt + k * 0.075, click(1700 + k * 50, dur=0.03), 0.07)
    put(tt + 1.4, blip(587.33, dur=0.4, tau=0.1), 0.12)

    # scene changes and HUD chips
    for n in (1, 2, 3, 4, 6, 7, 8, 10, 11, 14):
        put(L(n)[0] - 0.12, whoosh(0.35, 1600, 400, peak=0.4), 0.08, -0.2 if n % 2 else 0.2)

    # map: tunnel digging (low rumble) and the vault reached
    a, b = L(2)
    put(a, [x * 0.5 for x in bandnoise(int((b - a) * SR), lambda k: 140 + 40 * math.sin(k / SR * 6), q=0.6)], 0.25)
    put(W(2, "ate"), impact(0.8), 0.25)

    # weight: note pops, count-up ticks, "não cabe" buzzer
    put(L(4)[0] + 0.6, pop(500, 900), 0.18)
    put(W(4, "pesa"), blip(440.0, dur=0.3), 0.14)
    t5, tton = L(5)[0], W(5, "toneladas")
    k, t = 0, t5
    while t < tton:
        put(t, click(1500 + (k % 6) * 90, dur=0.025), 0.06)
        t += 0.06
        k += 1
    put(tton, impact(0.6), 0.2)
    put(W(5, "nao"), blip(146.83, dur=0.45, tau=0.15), 0.25)

    # used notes stamps, plan chip
    put(W(6, "usadas") - 0.05, click(700, dur=0.08), 0.3)
    put(W(6, "fora") - 0.05, click(700, dur=0.08), 0.3)

    # Bira gone: hit + crew counter drops
    put(W(8, "nao"), impact(1.0), 0.35)
    # phone: ring tones then voicemail beep
    p0 = L(9)[0] - 0.1
    for i in range(2):
        put(p0 + i * 0.6, blip(425.0, dur=0.4, tau=0.25), 0.12)
    put(L(9)[1] - 0.2, blip(880.0, dur=0.5, tau=0.3), 0.12)

    # radio static under the news flash
    a, b = L(10)
    put(a - 0.2, static(b - a + 0.6), 0.10)
    put(W(10, "plantao") - 0.05, blip(659.25, dur=0.35, tau=0.1), 0.15)

    # decision: heartbeat under the two options
    t = t11
    while t < L(14)[0]:
        put(t, heartbeat(), 0.22)
        t += 0.95
    put(L(12)[0], pop(400, 300), 0.2, -0.3)
    put(L(13)[0], pop(300, 200), 0.2, 0.3)
    put(L(14)[0] + 0.1, chime([293.66, 349.23, 440.0, 587.33], dur=2.4, tau=0.9), 0.12)
