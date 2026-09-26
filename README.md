# 30/15

Expo SDK 57 bike coach for **Rønnestad 30/15** micro-intervals. One number on the workout screen, spoken cues a beat early, and targets from your FTP.

**App name:** 30/15  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

---

## Run in Expo Go

```bash
npm install
npx expo start
```

1. Install **Expo Go**.
2. Scan the QR code. Phone and computer should share a network.

Auth, history, and the workout run in Expo Go. **Live power does not.** Expo Go has no Bluetooth stack. See [Power meter](#power-meter).

---

## Default session

| Block | Detail |
|--------|--------|
| Warm-up | 12 min progressive spin + **3× ~10s accelerations** near the end |
| Main | **3 sets × 13 reps** of **30s HARD / 15s EASY** |
| Between sets | **4 min** easy spinning |
| Cool-down | **10 min** easy pedaling |

### Default power (editable)

- **FTP = 125 W** (editable, never a gate)
- **HARD** = 120% FTP → **150 W**
- **EASY** = 50% FTP → **63 W**

A saved FTP is left alone. A fresh install starts at 125 W. Open the app and press **Start**. There is no sign-in before the first hard interval.

---

## Start

The first screen is home: FTP, the hard and easy targets, and **Start**. No account, no name, no streak. Settings holds the structure, spoken cues, past sessions, and an optional note.

## History

Sessions are written to **AsyncStorage** when a workout finishes, or when you end one after a few seconds. Each row stores date, duration, FTP, and whether you completed the plan. Open them from Settings. The home screen does not keep a streak.

There is no sign-in on this path. The workout does not wait on an account.

### Feedback

Settings → Leave a note. It is optional and free-form. No rating. No account.

When Supabase is configured, Send writes a row to `app_feedback`. Run [`supabase/app_feedback.sql`](supabase/app_feedback.sql) in the SQL editor. Anonymous inserts are allowed. Riders cannot read the table. You read notes in the Supabase Table Editor.

If the server is missing, the note stays on the phone and sends on a later try.

---

## Audio

Rocky lines are spoken, never printed. One welcome just after you start. One line 10–12 seconds into each hard 30. One line in the first 3 seconds of each easy 15, after the opening second. One finish line a second after the last interval. From 3 seconds before a change through 1 second after it, the clock is silent.

## Power meter

The app can read **FTMS Indoor Bike Data** (`0x2AD2`, power + speed) and the **Cycling Power Measurement** (`0x2A63`, watts only). Nothing is simulated. The workout screen shows the target only.

**Expo Go and the browser have no pair sheet and no power strip.** On a development build, Finish offers an optional power meter after you are done.

To connect a real meter:

```bash
npx expo install expo-dev-client
```

Add `eas.json` if you do not have one:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "production": {}
  }
}
```

```bash
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

Install that build (not Expo Go). Finish a session, then open Power meter. Wake the trainer and pick it from the list. Watts appear only after a real packet. The workout clock itself stays on target watts.

`react-native-ble-plx` is already a dependency. Its config plugin adds the iOS Bluetooth usage string and Android scan/connect permissions at prebuild (`neverForLocation`, since this is not a location scan).

---

## Audio cues

Spoken cues use **expo-speech**. The player module is **expo-audio** (not expo-av). Transition beeps are not fired: the three seconds before a change and the second after it stay quiet.

---

## Settings

FTP, hard/easy %, warm-up, sets, reps, work/recover, rest, cool-down, speech, voice rate, haptics. Stored in AsyncStorage.

---

## Limitations

- The timer uses wall-clock elapsed time. Keep the screen on (`expo-keep-awake`). If iOS suspends JavaScript, phase timing is best-effort.
- History on this path stays on the phone. There is no account step before the workout.
- Feedback reaches you only after `app_feedback` exists. Until then the note stays on the phone.
- A power meter is optional after Finish, and only in a development build. Expo Go never shows a pair sheet.

---

## Checks

```bash
npx tsc --noEmit
npm test
```
