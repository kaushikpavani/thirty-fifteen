#!/usr/bin/env python3
"""Pulse — the 30/15 score, and the cue sounds. Original synthesis, no samples.

  pip install numpy scipy
  python3 scripts/gen-pulse.py

128 BPM: one bar is 1.875 s, so a 30 s HARD is exactly 16 bars and a 15 s
EASY exactly 8. The engine restarts the bed at every phase change, so the
drop at bar 1 of drive lands on the Go chirp.

  assets/beds/drive.wav      HARD, A minor   (i–VI–III–VII)
  assets/beds/drive-b.wav    HARD, D minor
  assets/beds/recover.wav    EASY, A minor, riser in bar 8
  assets/beds/recover-b.wav  EASY, D minor
  assets/beds/ambient.wav    warm-up, set rest, cool-down (loops seamlessly)
  assets/beep-*.wav          count-in ticks, Go, release, set, finish
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
SR = 44100
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
rng = np.random.default_rng(3015)


# ---------- primitives ----------

def n_of(sec: float) -> int:
    return int(round(sec * SR))


def t_of(n: int) -> np.ndarray:
    return np.arange(n) / SR


def midi(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR * 0.45), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def saw(freq, n, phase=0.0):
    """PolyBLEP saw: bright without aliasing grit."""
    dt = freq / SR
    p = (phase + dt * np.arange(n)) % 1.0
    y = 2 * p - 1
    m1 = p < dt
    t1 = p[m1] / dt
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = p > 1 - dt
    t2 = (p[m2] - 1) / dt
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def env_ad(n, attack, decay, release=0.006):
    """Attack, exponential decay, and a short release so no chunk ever ends on a cliff."""
    t = t_of(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    e = a * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))
    r = min(n, n_of(release))
    if r > 1:
        e[-r:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def held(n_bar, attack, decay, release=0.35):
    """Length and envelope for a sustained note that rings a little into the next bar."""
    n = n_bar + n_of(release)
    return n, env_ad(n, attack, decay, release)


def place(buf, at, clip, gain=1.0):
    i = n_of(at) % len(buf)
    end = min(len(buf), i + len(clip))
    buf[i:end] += clip[: end - i] * gain
    rest = len(clip) - (end - i)
    if rest > 0:  # wrap: every bed is a loop
        buf[:rest] += clip[end - i:] * gain


def reverb(x, seconds=1.8, wet=0.22, tone=5000):
    n = len(x)
    ir_n = min(n_of(seconds), n)
    ir = rng.standard_normal(ir_n) * np.exp(-t_of(ir_n) * 6.9 / seconds)
    ir = lp(ir, tone)
    ir[: n_of(0.012)] = 0  # pre-delay
    ir /= np.sqrt(np.sum(ir ** 2)) or 1
    padded = np.zeros(n)
    padded[:ir_n] = ir
    y = np.real(np.fft.ifft(np.fft.fft(x) * np.fft.fft(padded)))  # circular: tails wrap into the loop
    return x * (1 - wet * 0.4) + y * wet


def lp_loop(x, f):
    return lp(np.concatenate([x, x]), f)[len(x):]


def delay(x, sec, fb=0.3, mix=0.25, tone=3500):
    d = n_of(sec)
    out = x.copy()
    tap = x.copy()
    for _ in range(5):
        tap = lp_loop(np.roll(tap, d), tone) * fb
        out += tap * (mix / fb)
    return out


# ---------- instruments ----------

def kick():
    n = n_of(0.42)
    t = t_of(n)
    f = 44 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    n = n_of(0.3)
    noise = bp(rng.standard_normal(n), 900, 2600)
    e = np.zeros(n)
    for k, off in enumerate((0.0, 0.011, 0.022)):
        e += env_ad(n, 0.001, 0.012 if k < 2 else 0.11) * (np.arange(n) >= n_of(off))
    return noise * e * 0.8


def hat(open_=False):
    n = n_of(0.35 if open_ else 0.08)
    noise = lp(hp(rng.standard_normal(n), 7000, 4), 13000)
    return noise * env_ad(n, 0.0008, 0.11 if open_ else 0.022) * 0.3


def crash():
    n = n_of(2.2)
    noise = hp(rng.standard_normal(n), 4200, 2)
    return noise * env_ad(n, 0.002, 0.7) * 0.5


def snare():
    n = n_of(0.2)
    t = t_of(n)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35)
    noise = bp(rng.standard_normal(n), 1500, 7000) * np.exp(-t * 22)
    return tone * 0.5 + noise * 0.7


def pluck(freq, dur, bright=4000):
    n = n_of(dur)
    x = saw(freq, n) * 0.6 + saw(freq * 1.004, n) * 0.4
    return lp(x, bright) * env_ad(n, 0.002, dur * 0.35)


def supersaw(freqs, n, voices=5, spread=0.012):
    out = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            det = 1 + spread * (v - (voices - 1) / 2) / ((voices - 1) / 2)
            out += saw(f * det, n, phase=rng.random())
    return out / (len(freqs) * voices) ** 0.5


# ---------- harmony ----------

# Bright, major, forward: I–V–vi–IV. Peppy without being cheesy.
FAMILIES = {
    "A": {"roots": [60, 55, 57, 53], "quality": ["M", "M", "m", "M"], "hook": 72},  # C G Am F
    "D": {"roots": [62, 57, 59, 55], "quality": ["M", "M", "m", "M"], "hook": 74},  # D A Bm G
}

# A two-bar hook in scale steps from the tonic (16ths; None = rest). Sung over bars 9–16.
HOOK = [0, None, 2, None, 4, None, 4, 2, None, 0, None, 2, 4, None, 7, None,
        7, None, 5, 4, None, 2, None, 0, 2, None, 4, None, 2, None, None, None]
MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14]


def chord(root, quality):
    third = 3 if quality == "m" else 4
    return [root, root + third, root + 7]


def sidechain(n, bars, every=BEAT, depth=0.65, release=0.18):
    """Gain curve that ducks on each kick and swells back — the breathing pump."""
    g = np.ones(n)
    t = t_of(n)
    phase = (t % every) / release
    g = 1 - depth * np.exp(-phase * 3.2)
    return g


# ---------- beds ----------

def drive(fam: str) -> np.ndarray:
    bars = 16
    n = n_of(bars * BAR)
    kit = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    pad = np.zeros(n)
    lead = np.zeros(n)
    k, c, ch, oh, sn = kick(), clap(), hat(), hat(True), snare()
    F = FAMILIES[fam]
    for bar in range(bars):
        b0 = bar * BAR
        cidx = bar % 4
        notes = chord(F["roots"][cidx], F["quality"][cidx])
        lift = bar / (bars - 1)
        for beat in range(4):
            place(kit, b0 + beat * BEAT, k, 1.0)
            if beat in (1, 3):
                place(kit, b0 + beat * BEAT, c, 0.55)
            place(kit, b0 + beat * BEAT + 2 * S16, oh, 0.35 + 0.25 * (bar >= 4))
            for s in range(4):
                vel = 0.25 + (0.18 if s == 2 else 0) + 0.1 * lift
                place(kit, b0 + beat * BEAT + s * S16, ch, vel)
            # rolling bass: the three sixteenths after each kick
            for s in (1, 2, 3):
                f = midi(notes[0] - 24)
                place(bass, b0 + beat * BEAT + s * S16, lp(saw(f, n_of(S16 * 0.95)), 900) * env_ad(n_of(S16 * 0.95), 0.003, 0.09), 0.8)
        if bar >= 12:  # last four bars: snare 8ths, extra push
            for e in range(8):
                place(kit, b0 + e * BEAT / 2, sn, 0.12 + 0.02 * e)
        # arp: 16ths through chord tones, filter opens across the rep so it lifts as you tire
        seq = [0, 1, 2, 1, 2, 0, 1, 2]
        for s in range(16):
            tone = notes[seq[s % 8]] + 12 + (12 if s % 8 in (3, 7) else 0)
            place(arp, b0 + s * S16, pluck(midi(tone), S16 * 1.6, 900 + 5200 * lift ** 1.4), 0.26 + 0.16 * lift)
        # offbeat chord stabs from bar 5: the house-piano lift
        if bar >= 4:
            for beat in range(4):
                sn_ = n_of(BEAT * 0.4)
                stab = lp(supersaw([midi(m + 12) for m in notes], sn_, voices=3, spread=0.006), 2600 + 2400 * lift) * env_ad(sn_, 0.003, 0.09)
                place(arp, b0 + beat * BEAT + BEAT / 2, stab, 0.3)
        # the hook, bars 9–16
        if bar >= 8:
            for s16 in range(16):
                step = HOOK[(bar % 2) * 16 + s16]
                if step is None:
                    continue
                f = midi(F["hook"] + MAJOR[step])
                hn = n_of(S16 * 1.8)
                tone_ = (np.sign(np.sin(2 * np.pi * f * t_of(hn))) * 0.35 + saw(f, hn) * 0.65)
                place(lead, b0 + s16 * S16, lp(tone_, 3200 + 2400 * lift) * env_ad(hn, 0.004, 0.16), 0.24)
        # pad
        pn, pe = held(n_of(BAR), 0.02, 6)
        chord_audio = lp(supersaw([midi(m) for m in notes], pn), 1400 + 1800 * lift) * pe
        place(pad, b0, chord_audio, 0.55)
    place(kit, 0, crash(), 0.8)  # the drop
    place(bass, 0, np.sin(2 * np.pi * 55 * t_of(n_of(0.8))) * env_ad(n_of(0.8), 0.002, 0.3), 0.9)
    pump = sidechain(n, bars)
    arp = delay(arp, BEAT * 0.75, fb=0.28, mix=0.22)
    lead = delay(lead, BEAT * 0.75, fb=0.25, mix=0.2)
    mix = (kit * 0.9 + bass * pump * 0.9 + reverb(arp, 1.4, 0.3) * pump * 0.9 + reverb(pad, 2.2, 0.35) * pump * 0.7
           + reverb(lead, 1.6, 0.3) * 0.9)
    return master(mix, target_rms=0.16)


def recover(fam: str) -> np.ndarray:
    bars = 8
    n = n_of(bars * BAR)
    kit = np.zeros(n)
    pad = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    oh, ch, sn = hat(True), hat(), snare()
    F = FAMILIES[fam]
    for bar in range(bars):
        b0 = bar * BAR
        cidx = (bar // 2) % 4
        notes = chord(F["roots"][cidx], F["quality"][cidx])
        for beat in range(4):
            place(kit, b0 + beat * BEAT + 2 * S16, oh, 0.18)
            place(kit, b0 + beat * BEAT, ch, 0.1)
        pn, pe = held(n_of(BAR), 0.25, 8, 0.5)
        place(pad, b0, lp(supersaw([midi(m) for m in notes], pn, spread=0.008), 1100) * pe, 0.6)
        bn, be = held(n_of(BAR), 0.05, 1.2, 0.2)
        place(bass, b0, lp(saw(midi(notes[0] - 24), bn), 300) * be, 0.5)
        for e in range(8):
            if e % 2 == 0 or bar == 7:
                place(arp, b0 + e * BEAT / 2, pluck(midi(notes[e % 3] + 12), BEAT, 1600), 0.16)
    # riser into the drop: noise swell + accelerating snare
    rn = n_of(BAR)
    ramp = np.linspace(0, 1, rn) ** 2.2
    noise = rng.standard_normal(rn)
    riser = np.zeros(rn)
    chunks = 24
    for i in range(chunks):
        a, b = i * rn // chunks, (i + 1) * rn // chunks
        lo = 400 + 5000 * (i / chunks) ** 1.5
        riser[a:b] = bp(noise, lo, min(lo * 2.2, 16000))[a:b]
    place(kit, 7 * BAR, riser * ramp, 0.5)
    for i, at in enumerate(list(np.arange(0, 2, 0.5)) + list(np.arange(2, 3, 0.25)) + list(np.arange(3, 4, 0.125))):
        place(kit, 7 * BAR + at * BEAT, sn, 0.08 + 0.25 * (at / 4) ** 1.5)
    mix = kit + reverb(pad, 2.6, 0.4) * 0.8 + bass * 0.7 + reverb(delay(arp, BEAT * 0.75), 2.0, 0.4)
    return master(mix, target_rms=0.12)


def ambient() -> np.ndarray:
    bars = 8
    n = n_of(bars * BAR)
    pad = np.zeros(n)
    arp = np.zeros(n)
    kit = np.zeros(n)
    k = lp(kick(), 180)
    F = FAMILIES["A"]
    for bar in range(bars):
        b0 = bar * BAR
        cidx = (bar // 2) % 4
        notes = chord(F["roots"][cidx], F["quality"][cidx])
        pn, pe = held(n_of(BAR), 0.4, 10, 0.6)
        place(pad, b0, lp(supersaw([midi(m) for m in notes + [notes[0] + 12]], pn, spread=0.006), 900) * pe, 0.6)
        for beat in range(4):
            place(kit, b0 + beat * BEAT, k, 0.35)
        for e in range(4):
            place(arp, b0 + e * BEAT + BEAT / 2, pluck(midi(notes[(bar + e) % 3] + 24), BEAT * 2, 1300), 0.1)
    mix = reverb(pad, 3.2, 0.5) + reverb(delay(arp, BEAT * 1.5, fb=0.35), 3.0, 0.5) + kit
    return master(mix, target_rms=0.1)


def master(x, target_rms):
    # filter the loop in steady state so the seam matches sample-for-sample
    x = hp(np.concatenate([x, x]), 32, 2)[len(x):]
    rms = np.sqrt(np.mean(x ** 2)) or 1
    x = x * (target_rms / rms)
    x = np.tanh(x * 1.3) / np.tanh(1.3)  # glue + soft limit
    peak = np.max(np.abs(x))
    if peak > 0.97:
        x *= 0.97 / peak
    return x


# ---------- cues ----------

def bell(freqs, dur, decay, partial=2.76):
    n = n_of(dur)
    t = t_of(n)
    y = np.zeros(n)
    for f in freqs:
        y += np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
        y += 0.35 * np.sin(2 * np.pi * f * partial * t) * np.exp(-t / (decay * 0.3))
    y *= env_ad(n, 0.002, 99)
    return y / max(1, len(freqs)) ** 0.7


def wood(f, dur=0.16):
    n = n_of(dur)
    t = t_of(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 38) + 0.4 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t * 90)
    return y * env_ad(n, 0.0015, 99)


def glass(f, dur=0.22):
    n = n_of(dur)
    t = t_of(n)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 3 * t)) * np.exp(-t * 22) * env_ad(n, 0.002, 99)


def thump(f=58, dur=0.3):
    n = n_of(dur)
    t = t_of(n)
    return np.sin(2 * np.pi * (f + 40 * np.exp(-t * 30)) * t) * np.exp(-t * 11)


def norm(x, peak=0.9):
    return x * (peak / (np.max(np.abs(x)) or 1))


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    beds = ROOT / "assets/beds"
    write_wav(beds / "drive.wav", drive("A"))
    write_wav(beds / "drive-b.wav", drive("D"))
    write_wav(beds / "recover.wav", recover("A"))
    write_wav(beds / "recover-b.wav", recover("D"))
    write_wav(beds / "ambient.wav", ambient())

    a = ROOT / "assets"
    A5, Cs6, E6, A6 = 880.0, 1108.73, 1318.51, 1760.0
    rung = {"3": A5, "2": Cs6, "1": E6}
    for k, f in rung.items():
        write_wav(a / f"beep-rung-{k}.wav", norm(wood(f), 0.85))
        write_wav(a / f"beep-rung-{k}b.wav", norm(glass(f), 0.85))
        write_wav(a / f"beep-rung-{k}c.wav", norm(wood(f / 2, 0.22) * 0.7 + glass(f) * 0.3, 0.85))
    write_wav(a / "beep-warn.wav", norm(wood(A5), 0.8))
    go = bell([A5, Cs6, E6, A6], 0.9, 0.28)
    tn = n_of(0.9)
    th = np.zeros(tn)
    th[: n_of(0.3)] = thump()
    write_wav(a / "beep-go.wav", norm(go + th * 0.9, 0.92))
    rel = np.zeros(n_of(0.5))
    rel[: n_of(0.3)] += bell([659.25], 0.3, 0.12, 2.0)
    rel[n_of(0.14): n_of(0.14) + n_of(0.34)] += bell([440.0], 0.34, 0.16, 2.0)
    write_wav(a / "beep-easy.wav", norm(lp(rel, 3000), 0.7))
    win = np.zeros(n_of(0.9))
    win[: n_of(0.5)] += bell([A5], 0.5, 0.18)
    win[n_of(0.16): n_of(0.16) + n_of(0.7)] += bell([E6, A6], 0.7, 0.3)
    write_wav(a / "beep-win.wav", norm(win, 0.9))
    done = bell([440.0, 554.37, 659.25, 880.0], 1.6, 0.6)
    write_wav(a / "beep-done.wav", norm(done, 0.88))
    heavy = bell([220.0, 440.0, 554.37, 659.25, 880.0], 2.2, 0.9)
    heavy[: n_of(0.3)] += thump(55) * 0.8
    write_wav(a / "beep-done-heavy.wav", norm(heavy, 0.92))
    print("pulse written")


if __name__ == "__main__":
    main()
