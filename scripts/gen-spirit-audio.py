#!/usr/bin/env python3
"""Generate the bundled spirit-high audio. No samples from other records.

Beds are original synthesis (loop-safe WAV). The HARD ladder, win chirp, and
heavy done beep are synthesized ticks. Optional neural reads cover the one-syllable
"Go." and the set-break line. Re-run from the repo root:

  python3 scripts/gen-spirit-audio.py
  python3 scripts/gen-spirit-audio.py --speech
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 44100
SEED = 3015


def lowpass(x: np.ndarray, cutoff: float, sr: int = SR) -> np.ndarray:
    if cutoff <= 0:
        return np.zeros_like(x)
    a = float(np.exp(-2 * np.pi * cutoff / sr))
    y = np.empty_like(x)
    acc = 0.0
    b = 1.0 - a
    for i, sample in enumerate(x):
        acc += b * (float(sample) - acc)
        y[i] = acc
    return y


def highpass(x: np.ndarray, cutoff: float, sr: int = SR) -> np.ndarray:
    return x - lowpass(x, cutoff, sr)


def env_exp(n: int, decay: float, sr: int = SR) -> np.ndarray:
    t = np.arange(n) / sr
    curve = np.exp(-t * decay)
    attack = max(1, int(0.0015 * sr))
    curve[:attack] *= np.linspace(0.0, 1.0, attack)
    return curve.astype(np.float64)


def place(buf: np.ndarray, start: int, clip: np.ndarray, gain: float = 1.0) -> None:
    if start >= len(buf) or gain == 0:
        return
    end = min(len(buf), start + len(clip))
    buf[start:end] += clip[: end - start] * gain


def write_wav(path: Path, samples: np.ndarray, sr: int = SR) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(samples, -1.0, 1.0)
    ints = (pcm * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sr)
        handle.writeframes(ints.tobytes())


def synth_drive(variant: int = 0) -> np.ndarray:
    """Four bars at 120 BPM. Kick on the quarter, brighter than the recover bed.
    Variant 1 keeps the same grid and shifts the riff and backbeat.
    """
    rng = np.random.default_rng(SEED if variant == 0 else SEED + 17)
    bars = 4
    step = int(SR * 0.125)  # 16th at 120 BPM
    total = step * 16 * bars
    kick_bus = np.zeros(total)
    drum_bus = np.zeros(total)
    bass_bus = np.zeros(total)
    bright_bus = np.zeros(total)

    def kick() -> np.ndarray:
        n = int(0.17 * SR)
        t = np.arange(n) / SR
        freq = 150.0 * np.exp(-t * 26.0) + 46.0
        phase = 2 * np.pi * np.cumsum(freq) / SR
        body = np.sin(phase)
        click = rng.standard_normal(n) * np.exp(-t * 220.0)
        return (body * 0.95 + click * 0.22) * env_exp(n, 16.0)

    def clap() -> np.ndarray:
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        burst = highpass(noise, 900.0) * np.exp(-t * 28.0)
        snap = highpass(rng.standard_normal(n), 1400.0) * np.exp(-t * 70.0)
        return (burst * 0.7 + snap * 0.45) * env_exp(n, 24.0)

    def hat(open_hat: bool) -> np.ndarray:
        decay = 9.0 if open_hat else 38.0
        n = int((0.16 if open_hat else 0.045) * SR)
        t = np.arange(n) / SR
        noise = highpass(rng.standard_normal(n), 3500.0)
        tone = np.sin(2 * np.pi * 6200.0 * t) * 0.08
        return (noise * 0.55 + tone) * np.exp(-t * decay)

    notes = {
        "A1": 55.00,
        "C2": 65.41,
        "D2": 73.42,
        "E1": 41.20,
        "E2": 82.41,
        "G1": 49.00,
        "A2": 110.00,
    }
    riff = [
        "A1", "A1", "C2", "A1", "E1", "A1", "G1", "A1",
        "A1", "C2", "D2", "C2", "A1", "G1", "A1", "E1",
        "A1", "A1", "C2", "E2", "D2", "C2", "A1", "G1",
        "A1", "C2", "A1", "G1", "E1", "E1", "A1", "A2",
    ]

    def bass(freq: float) -> np.ndarray:
        n = int(0.23 * SR)
        t = np.arange(n) / SR
        wave_sum = np.zeros(n)
        for harm, amp in ((1, 1.0), (2, 0.45), (3, 0.18), (4, 0.08)):
            wave_sum += np.sin(2 * np.pi * freq * harm * t) * amp
        return lowpass(wave_sum, 240.0) * env_exp(n, 8.5)

    kick_clip = kick()
    clap_clip = clap()
    hat_closed = hat(False)
    hat_open = hat(True)

    for bar in range(bars):
        for sixteenth in range(16):
            at = (bar * 16 + sixteenth) * step
            if sixteenth % 4 == 0:
                place(kick_bus, at, kick_clip, 0.92)
            claps = (4, 12) if variant == 0 else (6, 14)
            if sixteenth in claps:
                place(drum_bus, at, clap_clip, 0.48)
            if sixteenth % 2 == 0:
                open_hat = sixteenth == 14 and bar in (1, 3)
                place(bright_bus, at, hat_open if open_hat else hat_closed, 0.16 if open_hat else 0.11)
            elif bar != 2:
                place(bright_bus, at, hat_closed, 0.035)

    eighth = step * 2
    transpose = 1.0 if variant == 0 else 2 ** (2 / 12)
    for index, name in enumerate(riff):
        place(bass_bus, index * eighth, bass(notes[name] * transpose), 0.34)

    # Short minor stabs on the downbeat of bars 1 and 3. They die before the next kick.
    for bar in (0, 2):
        n = int(0.09 * SR)
        t = np.arange(n) / SR
        chord = (
            np.sin(2 * np.pi * 220.0 * t)
            + 0.7 * np.sin(2 * np.pi * 261.63 * t)
            + 0.55 * np.sin(2 * np.pi * 329.63 * t)
        )
        place(bright_bus, bar * 16 * step, lowpass(chord, 1800.0) * env_exp(n, 22.0), 0.07)

    sidechain = np.ones(total)
    window = int(0.12 * SR)
    for bar in range(bars):
        for beat in range(4):
            at = (bar * 16 + beat * 4) * step
            sidechain[at : at + window] *= np.linspace(0.35, 1.0, window)

    mix = kick_bus * 0.9 + drum_bus + bass_bus * sidechain + bright_bus
    mix = np.tanh(mix * 1.35)
    fade = int(0.012 * SR)
    mix[-fade:] *= np.linspace(1.0, 0.0, fade)
    mix[:8] *= np.linspace(0.0, 1.0, 8)
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix * (0.9 / peak)).astype(np.float64)


def synth_recover(variant: int = 0) -> np.ndarray:
    """One bar at 60 BPM. Warm pad, darker than drive, seamless partials.
    Variant 1 is the same length and seam, a slightly lower color.
    """
    rng = np.random.default_rng(SEED + 1 if variant == 0 else SEED + 23)
    total = SR * 4
    # Render an extra cycle so the lowpass is in steady state, then keep the second one.
    span = total * 2
    t_long = np.arange(span) / SR
    partials = (
        (
            (110.0, 0.22),
            (110.5, 0.08),
            (130.75, 0.16),
            (131.25, 0.05),
            (164.75, 0.13),
            (165.25, 0.04),
            (196.0, 0.09),
            (55.0, 0.28),
        )
        if variant == 0
        else (
            (98.0, 0.24),
            (98.4, 0.07),
            (123.47, 0.15),
            (146.83, 0.12),
            (185.0, 0.07),
            (49.0, 0.3),
        )
    )
    pad_long = np.zeros(span)
    for freq, amp in partials:
        pad_long += np.sin(2 * np.pi * freq * t_long) * amp
    trem = 0.92 + 0.08 * np.sin(2 * np.pi * 0.5 * t_long)
    pad = (lowpass(pad_long, 900.0) * trem)[total:]
    t = np.arange(total) / SR

    kick_bus = np.zeros(total)
    n = int(0.28 * SR)
    kt = np.arange(n) / SR
    freq = 90.0 * np.exp(-kt * 10.0) + 42.0
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env_exp(n, 6.0)
    for at in (0, 2 * SR):
        place(kick_bus, at, body, 0.45)

    # One breath across the loop so the noise meets itself at zero.
    breath = np.sin(np.pi * t / 4.0)
    air = lowpass(rng.standard_normal(total), 700.0) * 0.012 * breath

    mix = pad * 0.55 + kick_bus + air
    mix = np.tanh(mix * 1.05)
    # Pull the downbeat into the last sample so the pad doesn't tick on the loop.
    seam = 256
    ramp = np.linspace(0.0, 1.0, seam)
    mix[:seam] = mix[-1] * (1.0 - ramp) + mix[:seam] * ramp
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix * (0.62 / peak)).astype(np.float64)


def loop_error(samples: np.ndarray) -> float:
    jump = float(abs(samples[0] - samples[-1]))
    typical = float(np.median(np.abs(np.diff(samples[:8000])))) or 1e-9
    return jump / typical


def write_beds() -> None:
    pairs = (
        ("drive", synth_drive(0)),
        ("drive-b", synth_drive(1)),
        ("recover", synth_recover(0)),
        ("recover-b", synth_recover(1)),
    )
    for name, audio in pairs:
        write_wav(ROOT / "assets" / "beds" / f"{name}.wav", audio)
        rms = float(np.sqrt(np.mean(audio**2)))
        cent = spectral_centroid(audio, SR)
        print(
            f"{name}: {len(audio) / SR:.2f}s rms={rms:.3f} peak={np.max(np.abs(audio)):.2f} "
            f"cent={cent:.0f}Hz loopΔ={loop_error(audio):.5f}"
        )


def spectral_centroid(x: np.ndarray, sr: int) -> float:
    frame = 2048
    hop = 1024
    window = np.hanning(frame)
    freqs = np.fft.rfftfreq(frame, 1 / sr)
    cents = []
    for i in range(0, len(x) - frame, hop):
        mag = np.abs(np.fft.rfft(x[i : i + frame] * window))
        total = float(mag.sum())
        if total < 1e-6:
            continue
        cents.append(float((freqs * mag).sum() / total))
    return float(np.median(cents)) if cents else 0.0


def trim_voice(samples: np.ndarray, sr: int) -> np.ndarray:
    nz = np.where(np.abs(samples) > 0.012)[0]
    if len(nz) == 0:
        return samples
    start = max(0, int(nz[0] - 0.01 * sr))
    end = min(len(samples), int(nz[-1] + 0.045 * sr))
    clip = samples[start:end].copy()
    clip = clip - lowpass(clip, 80.0, sr)
    clip = np.tanh(clip * 1.15)
    fade_in = max(1, int(0.006 * sr))
    fade_out = max(1, int(0.02 * sr))
    clip[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    clip[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
    peak = float(np.max(np.abs(clip))) or 1.0
    return clip * (0.92 / peak)


def write_mp3(path: Path, samples: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = samples.astype(np.float32).tobytes()
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "f32le",
            "-ar",
            str(sr),
            "-ac",
            "1",
            "-i",
            "pipe:0",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "48k",
            "-ar",
            "24000",
            str(path),
        ],
        input=raw,
        check=True,
    )


BEEP_SR = 22050


def tick(
    freq: float,
    seconds: float,
    gain: float,
    decay: float,
    sr: int = BEEP_SR,
    color: str = "a",
) -> np.ndarray:
    n = int(sr * seconds)
    t = np.arange(n) / sr
    env = np.exp(-t * decay)
    attack = max(1, int(0.002 * sr))
    env[:attack] *= np.linspace(0.0, 1.0, attack)
    if color == "b":
        body = (
            np.sin(2 * np.pi * freq * t) * 0.68
            + np.sin(2 * np.pi * freq * 2.0 * t) * 0.22
            + np.sin(2 * np.pi * freq * 3.0 * t) * 0.12
        )
    elif color == "c":
        body = np.sin(2 * np.pi * freq * t) * 0.94 + np.sin(2 * np.pi * freq * 2.0 * t) * 0.06
    else:
        body = np.sin(2 * np.pi * freq * t) * 0.82 + np.sin(2 * np.pi * freq * 2.02 * t) * 0.18
    return (body * env * gain).astype(np.float64)


def write_marks() -> None:
    """Rising ticks into HARD, one win chirp, one heavier done beep. No speech."""
    out = ROOT / "assets"
    rungs = (
        ("beep-rung-3.wav", 660.0, 0.07, 0.34, 34.0),
        ("beep-rung-2.wav", 880.0, 0.075, 0.48, 30.0),
        ("beep-rung-1.wav", 1174.0, 0.085, 0.66, 26.0),
    )
    for name, freq, seconds, gain, decay in rungs:
        audio = tick(freq, seconds, gain, decay)
        write_wav(out / name, audio, BEEP_SR)
        print(f"{name}: {seconds:.3f}s peak {float(np.max(np.abs(audio))):.2f}")
        for suffix, color, ratio in (("b", "b", 1.028), ("c", "c", 0.974)):
            alt = tick(freq * ratio, seconds, gain, decay, color=color)
            alt_name = name.replace(".wav", f"{suffix}.wav")
            write_wav(out / alt_name, alt, BEEP_SR)
            print(f"{alt_name}: peak {float(np.max(np.abs(alt))):.2f}")

    win = np.concatenate([tick(988.0, 0.07, 0.5, 32.0), tick(1480.0, 0.09, 0.62, 24.0)])
    write_wav(out / "beep-win.wav", win, BEEP_SR)
    print(f"beep-win.wav: {len(win) / BEEP_SR:.3f}s peak {float(np.max(np.abs(win))):.2f}")

    done = tick(196.0, 0.28, 0.72, 8.0)
    overtone = tick(392.0, 0.22, 0.28, 10.0)
    done[: len(overtone)] += overtone
    peak = float(np.max(np.abs(done))) or 1.0
    done = done * (0.55 / peak)
    write_wav(out / "beep-done-heavy.wav", done, BEEP_SR)
    print(f"beep-done-heavy.wav: {len(done) / BEEP_SR:.3f}s peak {float(np.max(np.abs(done))):.2f}")


async def write_pool() -> None:
    """Alternate takes in the same voice. Does not rewrite the original hot lines."""
    import edge_tts

    voice = "en-US-SteffanNeural"
    lines = {
        "hard-1": "Hold the line. You're in it.",
        "hard-2": "This is the work. Stay with it.",
        "hard-3": "Chin up. Push the watts.",
        "easy-1": "Easy. Reload.",
        "easy-2": "Good. Next one's yours.",
    }
    out_dir = ROOT / "assets" / "rocky"
    tmp = out_dir / "_pool"
    tmp.mkdir(parents=True, exist_ok=True)
    for name, text in lines.items():
        src = tmp / f"{name}.mp3"
        communicate = edge_tts.Communicate(text, voice, rate="+0%", pitch="-8Hz")
        await communicate.save(str(src))
        raw = subprocess.check_output(
            ["ffmpeg", "-v", "error", "-i", str(src), "-f", "f32le", "-ac", "1", "-ar", "24000", "-"]
        )
        audio = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
        trimmed = trim_voice(audio, 24000)
        write_mp3(out_dir / f"{name}.mp3", trimmed, 24000)
        print(f"{name}: {len(trimmed) / 24000:.2f}s")
    for child in tmp.iterdir():
        child.unlink()
    tmp.rmdir()


async def write_lines() -> None:
    import edge_tts

    voice = "en-US-SteffanNeural"
    lines = {
        "go": ("Go.", "+4%", "-10Hz"),
        "round": ("Round won. Stay sharp.", "+0%", "-8Hz"),
    }
    out_dir = ROOT / "assets" / "rocky"
    tmp = out_dir / "_tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    for name, (text, rate, pitch) in lines.items():
        src = tmp / f"{name}.mp3"
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await communicate.save(str(src))
        raw = subprocess.check_output(
            ["ffmpeg", "-v", "error", "-i", str(src), "-f", "f32le", "-ac", "1", "-ar", "24000", "-"]
        )
        audio = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
        trimmed = trim_voice(audio, 24000)
        dest = out_dir / f"{name}.mp3"
        write_mp3(dest, trimmed, 24000)
        print(f"{name}: {len(trimmed) / 24000:.2f}s")
    for child in tmp.iterdir():
        child.unlink()
    tmp.rmdir()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--speech", action="store_true", help="Regenerate Go., the set-break line, and the pools")
    args = parser.parse_args()
    write_beds()
    write_marks()
    if args.speech:
        asyncio.run(write_pool())


if __name__ == "__main__":
    main()
