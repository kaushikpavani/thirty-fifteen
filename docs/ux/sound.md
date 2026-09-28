# Sound — say less, say it on time

Every cue owns a moment. Nothing talks over anything else.

## Pulse (built-in music)

- 128 BPM. A 30 s HARD is exactly 16 bars, a 15 s EASY exactly 8. The engine restarts the bed at each phase change, so the drop lands on Go.
- Bright major I–V–vi–IV. HARD: kick, rolling bass, clap, offbeat chord stabs from bar 5, a hook from bar 9; the arp filter opens across the rep so it lifts as you tire. EASY: pad and hats, a riser in bar 8. Warm-up, set rest and cool-down: the ambient bed (filtered four-on-the-floor, pad).
- Two key families per install, chosen per ride (C and D). Rendered by `scripts/gen-pulse.py`, original synthesis, loop-safe.
- The bed dips 12 dB under the voice and ticks. It never drops to silence. The Go chirp only clears its own attack.
- “Your music”: Spotify / Apple Music keep playing and dip under cues (iOS mix + short duck).

## Coach voices

| Voice | Character | Default |
| --- | --- | --- |
| Coach (`direct`) | Bright, motivating. Counts you in. | yes |
| Calm | Warm, unhurried, few words | |
| Numbers only | Rep counts and milestones | |
| Off | Ticks and haptics only | |

- At most one line per rep; every fourth plain rep is quiet. Rep-aware: Halfway (rep 7 of 13), Three to go (rep 11), Last one (rep 13).
- Spoken count-in (default on): “Three! Two! One!” on the ladder into every HARD, then “Go!” on the flip. Ticks stay underneath at 35 %.
- Never speak from T−3 to T+1 except the count itself.
- Clips live in `assets/voice/<voice>/`. Human recordings win: see [voice-script.md](voice-script.md).

## Ticks and haptics

| Moment | Sound | Haptic |
| --- | --- | --- |
| T−3, T−2, T−1 into HARD | rising wood ticks A5 → C♯6 → E6 | light |
| HARD starts | bright bell chord + low thump | heavy double knock |
| EASY starts | soft falling release tone | light |
| Set done | two-note rising chime | medium |
| Finish | warm chord bloom | — |
