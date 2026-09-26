# 30/15

Expo SDK 57 bike coach for **Rønnestad 30/15** micro-intervals. One number on the workout screen, spoken cues a beat early, and targets from your FTP.

**App name:** 30/15  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

---

## Run in Expo Go

```bash
npm install
npx expo start -c --lan
```

Use **`npx expo`**, not `npm expo`. If install reports `Cannot find module 'expo/config-plugins'`, the tree is stale. Delete `node_modules` and run `npm install` again. Do not run `npm audit fix`; it can leave the Expo SDK 57 set.

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

The first screen is home: FTP, the hard and easy targets, and **Start**. No account, no name, no streak. Settings holds the structure, music, spoken cues, past sessions, and an optional note.

## History

Sessions are written to **AsyncStorage** when a workout finishes, or when you end one after a few seconds. Each row stores date, duration, FTP, and whether you completed the plan. Open them from Settings. The home screen does not keep a streak.

There is no sign-in on this path. The workout does not wait on an account.

### Feedback

Settings → Leave a note. It is optional and free-form. No rating. No account.

When Supabase is configured, Send writes a row to `app_feedback`. Run [`supabase/app_feedback.sql`](supabase/app_feedback.sql) in the SQL editor. Anonymous inserts are allowed. Riders cannot read the table. You read notes in the Supabase Table Editor.

If the server is missing, the note stays on the phone and sends on a later try.

---

## Audio

Rocky lines are spoken, never printed. One welcome just after you start. One line 10–12 seconds into each hard 30, rotating through four takes. One line in the first 3 seconds of each easy 15, after the opening second, from four takes — every fourth easy stays quiet. One finish line a second after the last interval, one of two. The set-break line is one of two. The same voice throughout. Rocky stays quiet from 3 seconds before a change through 1 second after it. Which take plays is fixed for the session from the start time. It does not shuffle mid-rep.

Into each HARD, including the first one after the warm-up, three rising ticks land at 3, 2, and 1. The slots do not move. Each approach uses one of three timbres. The existing go chirp and a heavy haptic land on the flip. The first HARD of the session adds one syllable, "Go.", on that chirp, then silence. EASY does not get a beep. There is no spoken count and no caption.

When the last easy of a set opens the set rest, one win chirp plays with "Round won. Stay sharp." The clock punches once and the rail flashes, then the rest breathes cool. The finish line sits on a heavier done beep. The screen blooms once in the go color, then holds. The button says Done.

A generated instrumental bed starts with the ride. Drive (hotter) under HARD and the accelerations. Recover (cooler) under the spin, the fifteens, set rest, and the cool-down. Each family has a second loop, and the set picks which one. The HARD glow steps through three warm reds, one per set. The bed drops out while Rocky speaks and from T−3 through T+1, then comes back. Settings → Music turns it off. Default is on. Nothing on Home plays the bed before Start. The phone's silent switch still lets the ride play, same as the cues.

The four lines are recorded (a direct neural voice) and played with expo-audio, including when the phone is on silent. If a clip cannot load, the app falls back to the best on-device English voice it can find, pitched slightly down and never faster than a normal speaking rate. Skip, shorten, and restart do not speak.

## During the ride

While the clock is running, Pause is the only control. Pause opens the rest, top to bottom: Resume, Shorten, Skip, Restart, End.

- **Shorten** ends the current segment now and continues. One tap.
- **Skip** leaves the block: warm-up goes to the first hard interval, a hard interval goes to its easy, an easy or set rest goes to the next hard, and cool-down finishes the session. One tap.
- **Restart** rewinds the current segment after one confirm.
- **End** asks once (`Cancel` or `End session`).

Planned watts stay on Home. The countdown is the only hero during the ride.

## Power meter

The app can read **FTMS Indoor Bike Data** (`0x2AD2`, power + speed) and the **Cycling Power Measurement** (`0x2A63`, watts only). Nothing is simulated. Planned watts stay on Home.

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

Rocky cues are short recordings played with **expo-audio** (not expo-av). **expo-speech** is only the fallback. Rising ticks at T−3, T−2, and T−1 lead only into HARD, then the go chirp. EASY stays quiet. The set-break line and "Go." are recorded the same way. Rocky does not talk over the clock. The beds are short original loops in the app, not a streaming service. Nothing in the ride invents watts.

---

## Settings

FTP, hard/easy %, warm-up, sets, reps, work/recover, rest, cool-down, music, speech, voice rate, haptics. Stored in AsyncStorage. The finish screen's primary button says Done.

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
