# 30/15

Expo SDK 57 bike coach for **Rønnestad 30/15** micro-intervals. One number on the workout screen, spoken cues a beat early, and targets from your FTP.

**App name:** 30/15  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

## Offline first

The phone is the source of truth. Airplane mode still runs a complete session.

- Workouts, FTP and the other settings, the feedback outbox, the install id, and the analytics outbox live on the device.
- Start, the interval clock, spoken cues, the music bed, and history do not wait on the network or on Supabase.
- Sync is best-effort and later. When the phone is online, queued notes and analytics flush. When you are also signed in, finished sessions merge. A failure stays queued. History may show a soft note. The ride does not stop.
- Strava, Garmin, and BLE imports are optional and not part of this build. The coach does not call them to run a workout.
- An account is optional. There is no login wall before Start.

FTP saved on the phone is what the ride uses. A profile in Supabase is only a copy.

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

The first screen is home: FTP, the hard and easy targets, and **Start**. No account, no name, no streak. Settings holds the structure, music, spoken cues, past sessions, an optional note, and an optional account.

## History

Sessions are written to **AsyncStorage** when a workout finishes, or when you end one after a few seconds. Each row stores date, duration, FTP, and whether you completed the plan. Open them from Settings. The home screen does not keep a streak.

There is no sign-in on this path. The workout does not wait on an account. History on the screen is the copy on the phone. If you later sign in from Settings, finished sessions also copy to this app's Supabase project and merge back when the network is there.

### Feedback

Settings → Leave a note. It is optional and free-form. No rating. No account.

When Supabase is configured, Send writes a row to `app_feedback` and tags the install when it can. Anonymous inserts are allowed. Riders cannot read the table. You read notes in the Supabase Table Editor.

The note is stored on the phone first. If the server is missing, it stays in the outbox and sends on a later try.

## Cloud

30/15 uses its **own** Supabase project. Create a dedicated project for this app. Do not use the BioAge project. Do not share a Supabase project or tables with any other app.

Without those keys, the app stays fully local. Workouts, notes, analytics, and Start all work.

1. Create a new Supabase project for 30/15 only.
2. Open the SQL editor and run these in order. Both are safe to run again.
   - [`supabase/migrations/20260926120000_foundation.sql`](supabase/migrations/20260926120000_foundation.sql)
   - [`supabase/migrations/20260926143000_offline_outbox.sql`](supabase/migrations/20260926143000_offline_outbox.sql)
3. In Project Settings → API, copy the project URL and the publishable key.
4. Copy `.env.example` to `.env.local` and paste the two values:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. Restart Expo (`npx expo start -c`).

Optional sign-in: in the Supabase dashboard, enable Google and Facebook, and allow the redirect `thirtyfifteen://auth-callback`. Settings → Account. Home → Start does not use it.

What the script creates:

| Table | Who can write | What it holds |
| --- | --- | --- |
| `profiles` | The signed-in rider | Display name, FTP copy, last seen |
| `devices` | `touch_device` only | This install, before or after sign-in |
| `app_events` | Insert only, including anonymous | App open, sign in, workout start/finish, feedback. `client_event_id` dedupes the phone outbox |
| `workout_sessions` | The signed-in rider, own rows | Finished sessions. `source` defaults to `manual`. The phone copy is kept either way |
| `app_feedback` | Insert only, including anonymous | Notes. No rider reads. `client_id` dedupes the phone outbox |
| `connections` | Service role later | Strava / Garmin / BLE link status. No OAuth tokens |
| `imported_activities` | Service role later | Imported activities, unique on provider + external id |

`connections.metadata` rejects token-like keys. Real tokens belong in an Edge Function and Supabase Vault, not in a client-readable column.

Owner views `owner_daily_active`, `owner_new_profiles`, and `owner_workouts_completed` are for the SQL editor. The app key cannot read them.

```sql
select * from public.owner_daily_active order by day desc;
select * from public.owner_new_profiles order by day desc;
select * from public.owner_workouts_completed order by day desc;
```

---

## Audio

Rocky lines are spoken, never printed. One welcome just after you start. One line 10–12 seconds into each hard 30, from four takes, never the same line twice in a row. One line in the first 3 seconds of each easy 15, after the opening second, from three takes — about one easy in four stays quiet. The first HARD says “Go.” once. The set break says “Round won. Stay sharp.” The finish line is fixed. Rocky stays quiet from 3 seconds before a change through 1 second after it. Which take plays follows the rep and the start time. It does not move the clock.

Into each HARD, including the first one after the warm-up, three ticks land at 3, 2, and 1. The slots do not move. An approach is rising pitch, rising volume, or two light ticks and a stronger third, then the same go chirp. About one HARD in five after the first skips the ladder and keeps a single warn at T−3 plus the chirp. The first HARD of the session adds one syllable, "Go.", on that chirp, then silence. EASY does not get a beep. There is no spoken count and no caption.

When the last easy of a set opens the set rest, one win chirp plays with "Round won. Stay sharp." The clock punches once and the rail flashes, then the rest breathes cool. The finish line sits on a heavier done beep. The screen blooms once in the go color, then holds. The button says Done.

A generated instrumental bed starts with the ride. Start picks one of three beds for the session. Drive stays hotter under HARD. Recover stays cooler under the fifteens and rest. The HARD glow steps around the same red, once per interval, and crossfades when the interval opens. Home may show a short tip under the structure. About one open in four shows none. Start is always there. The finish title is one of three lines. The button says Done. The bed drops out while Rocky speaks and from T−3 through T+1, then comes back. Settings → Music turns it off. Default is on. Nothing on Home plays the bed before Start. The phone's silent switch still lets the ride play, same as the cues.

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
- History, FTP, notes, and analytics stay on the phone. Cloud sync is a later best-effort flush. Start, the clock, cues, and the music bed do not wait for it.
- Feedback reaches the dashboard only after the SQL has been run and the phone can reach it. Until then the note stays in the outbox.
- A power meter is optional after Finish, and only in a development build. Expo Go never shows a pair sheet.

---

## Checks

```bash
npx tsc --noEmit
npm test
```
