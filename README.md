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

Rocky lines are spoken, never printed. One welcome just after you start. One line 10–12 seconds into each hard 30, from four takes, never the same line twice in a row. One line in the first 3 seconds of each easy 15, after the opening second, from three takes — about one easy in four stays quiet. The first HARD says “Go.” once. The set break says “Round won. Stay sharp.” The finish line is fixed. Rocky stays quiet from 3 seconds before a change through 1 second after it. Which take plays follows the rep and the start time. It does not move the clock.

Into each HARD, including the first one after the warm-up, three ticks land at 3, 2, and 1. The slots do not move. An approach is rising pitch, rising volume, or two light ticks and a stronger third, then the same go chirp. About one HARD in five after the first skips the ladder and keeps a single warn at T−3 plus the chirp. The first HARD of the session adds one syllable, "Go.", on that chirp, then silence. EASY does not get a beep. There is no spoken count and no caption.

When the last easy of a set opens the set rest, one win chirp plays with "Round won. Stay sharp." The clock punches once and the rail flashes, then the rest breathes cool. The finish line sits on a heavier done beep. The screen blooms once in the go color, then holds. The button says Done.

A generated instrumental bed starts with the ride. Start picks one of three beds for the session. Drive stays hotter under HARD. Recover stays cooler under the fifteens and rest. The HARD glow steps around the same red, once per interval, and crossfades when the interval opens. Home may show a short tip under the structure. About one open in four shows none. Start is always there. The finish title is one of three lines. The button says Done. The bed drops out while Rocky speaks and from T−3 through T+1, then comes back. Settings → Music turns it off. Default is on. Nothing on Home plays the bed before Start. The phone's silent switch still lets the ride play, same as the cues. The bed keeps looping if you leave the app, so the clock and the cues keep their places. See [Background](#background).

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
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

The development profile is in [`eas.json`](eas.json).

Install that build (not Expo Go). Finish a session, then open Power meter. Wake the trainer and pick it from the list. Watts appear only after a real packet. The workout clock itself stays on target watts.

`react-native-ble-plx` is already a dependency. Its config plugin adds the iOS Bluetooth usage string and Android scan/connect permissions at prebuild (`neverForLocation`, since this is not a location scan).

---

## Audio cues

Rocky cues are short recordings played with **expo-audio** (not expo-av). **expo-speech** is only the fallback. Rising ticks at T−3, T−2, and T−1 lead only into HARD, then the go chirp. EASY stays quiet. The set-break line and "Go." are recorded the same way. Rocky does not talk over the clock. The beds are short original loops in the app, not a streaming service. Nothing in the ride invents watts.

---

## Background

Leaving the app, or locking the screen, does not pause the ride. Pause still means Pause. The glow and the rail stop moving while another app is in front. The clock does not. Maintainer notes, the catch-up proof, and the platform limits are in [BACKGROUND.md](BACKGROUND.md).

**iOS** mixes with other audio and ducks it only while a cue is already silencing our bed. YouTube keeps playing. There is no lock-screen remote, because that API requires exclusive audio and would pause YouTube for the whole ride.

**Android** takes exclusive audio for a running ride and shows a media notification (segment label, no watts, no seek). Notification pause pauses the workout. Notification play resumes it. YouTube stays paused while the ride is running.

`playsInSilentMode` keeps the ride audible with the iOS silent switch on, and with Android silent or vibrate. Expo Go does not apply this project's native background config. Use a development build. See [BACKGROUND.md](BACKGROUND.md).

### Manual test

1. Install a development build (iOS and, if you can, Android). Not Expo Go.
2. Start a workout. Confirm the bed is audible.
3. Switch to YouTube, or lock the screen, for several HARD/EASY pairs (more than a minute, and on Android more than three).
4. You should hear the T−3 / T−2 / T−1 ladder, the phase chirp, and Rocky on time. On iOS, YouTube should keep playing and dip under each cue. On Android, YouTube pauses while the ride owns audio.
5. Return to 30/15. The countdown should match the time you were away. The ride should not be paused.
6. Pause in the app. Cues and the bed stop. Resume. They continue from that second, without replaying a cue whose window already ended.
7. On Android, pause from the notification. Cues stop. Play from the notification. They continue. On iOS, the lock screen has no remote for this app.
8. Turn Music off, start again, leave the app. Cues should still arrive. No bed tone.

The OS can still kill a background app. Battery use is higher while the session is held. A phone call can silence the bed until you return to the app. `expo-speech` is not the background path.

---

## Settings

FTP, hard/easy %, warm-up, sets, reps, work/recover, rest, cool-down, music, speech, voice rate, haptics. Stored in AsyncStorage. The finish screen's primary button says Done.

---

## Limitations

- The timer is wall-clock time. While the app is in front, `expo-keep-awake` holds the screen on. In the background the bed (or a silent loop) holds the audio session. If the OS freezes or kills the process, the clock snaps forward on return and does not replay missed cues. See [BACKGROUND.md](BACKGROUND.md).
- History on this path stays on the phone. There is no account step before the workout.
- Feedback reaches you only after `app_feedback` exists. Until then the note stays on the phone.
- A power meter is optional after Finish, and only in a development build. Expo Go never shows a pair sheet.

---

## Checks

```bash
npx tsc --noEmit
npm test
```

Pull requests run both in GitHub Actions (`.github/workflows/ci.yml`). The YouTube check is on a device. The steps are in [BACKGROUND.md](BACKGROUND.md).
