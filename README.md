# 30/15 Coach

Polished Expo (SDK 57) bike coaching timer for **Rønnestad / GCN-style 30/15 micro-intervals**.

Spoken cues fire a beat early (~0.8s), big countdown UI, dark cycling aesthetic, fixed structure with editable FTP and session params.

**App name:** 30/15 Coach  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

---

## Run on iPhone (Expo Go)

Prefer the **same Wi‑Fi** as your computer. Avoid relying on tunnels if certificates fail.

From a fresh clone on a Mac:

```bash
git clone https://github.com/kaushikpavani/thirty-fifteen.git
cd thirty-fifteen
npm install
npx expo start -c --lan
```

The dev command is **`npx expo`**, not `npm expo`. There is no npm script named `expo`, so `npm expo` fails immediately. `npm start` also works; it runs the same `expo start` script.

`npm install` may print moderate vulnerability warnings and suggest `npm audit fix`. **Ignore that.** Do not run `npm audit` or `npm audit fix`. Those commands can upgrade packages off the Expo SDK 57 set.

If `npx expo start` then reports `Cannot find module 'expo/config-plugins'`, the install tree is stale. Reinstall without audit fixes:

```bash
rm -rf node_modules
npm install
npx expo start -c --lan
```

1. Install **Expo Go** from the App Store (the build that matches SDK 57).
2. Scan the QR code from the terminal (Camera app or Expo Go).
3. Keep the phone and the Mac on the same network.

`--lan` is the recommended connection. Use a tunnel only if the phone cannot reach the computer:

```bash
npx expo start -c --tunnel
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

Spoken cues use **expo-speech**. Short WAV beeps use **expo-audio**, which current Expo Go includes. They fire ~0.5–1s early so you can react.

`expo-av` is not used. That package’s `ExponentAV` native module was removed from Expo Go in SDK 55, and importing it crashed the app on launch (`Cannot find native module 'ExponentAV'`). Beeps are loaded lazily: if the audio native module is missing, the workout still runs with speech and haptics only.

After pulling this change, reinstall dependencies and restart Metro with a clean cache:

```bash
npm install
npx expo start -c --lan
```

Reload the project in **current Expo Go** (the App Store build that matches SDK 57). A custom development build is not required for beeps.

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
