# 30/15 Coach

Polished Expo (SDK 57) bike coaching timer for **Rønnestad / GCN-style 30/15 micro-intervals**.

Spoken cues fire a beat early (~0.8s), big countdown UI, dark cycling aesthetic, fixed structure with editable FTP and session params.

**App name:** 30/15 Coach  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

---

## Run on iPhone (Expo Go)

Prefer the **same Wi‑Fi** as your computer. Avoid relying on tunnels if certificates fail.

```bash
cd /workspace/thirty-fifteen   # or your local clone path
npm install
npx expo start
```

1. Install **Expo Go** from the App Store.
2. Scan the QR code from the terminal / browser (Camera app or Expo Go).
3. Keep phone and computer on the same network.

Optional:

```bash
npx expo start --lan     # LAN (recommended)
# npx expo start --tunnel  # only if LAN cannot connect
```

---

## Default session

| Block | Detail |
|--------|--------|
| Warm-up | 12 min progressive spin + **3× ~10s accelerations** near the end |
| Main | **3 sets × 13 reps** of **30s HARD / 15s EASY** (~9.5 min/set) |
| Between sets | **4 min** easy spinning |
| Cool-down | **10 min** easy pedaling |

### Default power (editable)

- **FTP = 125 W** (asked on first launch; always editable in Settings)
- **HARD** = 120% FTP → **150 W** (“above FTP”)
- **EASY** = 50% FTP → **63 W** (“light pressure, don’t coast”)

Changing FTP (onboarding modal or Settings) immediately updates derived HARD/EASY targets.

---

## Audio cues

Cues use **expo-speech** (spoken) and short **WAV beeps** (expo-av). They fire ~0.5–1s early so you can react.

Examples:

- Warm-up start / acceleration warnings
- “Hard!” / “Easy. Light pressure. Do not coast.”
- Set complete / between-set rest
- Cool-down / workout done

Pause freezes the timer and suppresses further cues until resume.

---

## Settings (persisted)

FTP, hard/easy %, warm-up min, sets, reps, work/recover seconds, between-set rest, cool-down, speech on/off, voice rate, beeps, haptics, cue lead time.

Stored with **AsyncStorage**.

---

## Limitations

- Timer uses **elapsed wall-clock** (`Date.now`) to limit drift while the app stays in the foreground.
- If iOS suspends the JS thread in the background, phase timing is **best-effort** — keep the screen on (we use `expo-keep-awake`) and avoid locking the phone mid-set for critical accuracy.
- No login, no backend, no power meter connection — targets are coaching numbers only.

---

## Typecheck

```bash
npx tsc --noEmit
```
