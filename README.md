# 30/15

Expo SDK 57 bike coach for **Rønnestad 30/15** micro-intervals. One number on the workout screen, spoken cues a beat early, and targets from your FTP.

**App name:** 30/15  
**Bundle ID / scheme:** `com.kaushikpavani.thirtyfifteen` / `thirtyfifteen`

## UX design

Markdown wireframes in [docs/ux/README.md](docs/ux/README.md) are the source of truth for UI work. PNGs are reference only.

## Offline first

The phone is the source of truth. Airplane mode still runs a complete session.

- Workouts, FTP and the other settings, the feedback outbox, the install id, and the analytics outbox live on the device.
- Start, the interval clock, spoken cues, the music bed, and history do not wait on the network or on Supabase.
- Sync is best-effort and later. When the phone is online, queued notes and analytics flush. When you are also signed in, finished sessions merge. A failure stays queued. History may show a soft note. The ride does not stop.
- Strava, Garmin, and BLE imports are optional and not part of this build. The coach does not call them to run a workout.
- An account is optional. There is no login wall before Start.

Not signed in, history, FTP, settings, and the outboxes live on this phone. Start does not ask for an account or a network. Finished sessions stay here until you sign in.

Signed in, the profile and finished sessions copy to this app's Supabase project when the phone is online. Queued notes and analytics can flush when the project is configured, signed in or not. A miss stays queued. The ride still does not wait.

FTP saved on the phone is what the ride uses. A profile in Supabase is only a copy.

## Free

This coach is free. Forever. There is no Pro tier, no paywall, no entitlement check, and no in-app purchase. The point is the ride.

---

## Run in Expo Go

```bash
npm install
npx expo start -c --lan
```

Use **`npx expo`**, not `npm expo`. If install reports `Cannot find module 'expo/config-plugins'`, the tree is stale. Delete `node_modules` and run `npm install` again. Do not run `npm audit fix`; it can leave the Expo SDK 57 set.

1. Install **Expo Go**.
2. Scan the QR code. Phone and computer should share a network.

Auth, history, and the workout run in Expo Go. **Live power does not.** Expo Go has no Bluetooth stack, and it does not apply this project's background audio config. See [Power meter](#power-meter). A home-screen install on a physical iPhone, with a free Apple ID, is a local compile on a Mac: [Install on an iPhone from a Mac](IOS-LOCAL-INSTALL.md).

---

## Default session

| Block | Detail |
|--------|--------|
| Warm-up | 12 min progressive spin + **3× ~10s accelerations** near the end |
| Main | **2 sets × 13 reps** of **30s HARD / 15s EASY** |
| Between sets | **4 min** easy spinning |
| Cool-down | **10 min** easy pedaling |

### Default power (editable)

- **FTP = 120 W** (editable, never a gate)
- **HARD** = 120% FTP → **144 W**
- **EASY** = 50% FTP → **60 W**

A saved FTP is left alone. A fresh install starts at 120 W and 2 sets. Open the app and press **Start**. There is no sign-in before the first hard interval.

---

## Start

The first launch is a welcome with the road and the bike. After that, home is the power and heart rate chips, **Start**, Why 30/15, and Settings. FTP and the hard and easy targets live in Settings, not on home. No account, no name, no streak. Start is never gated on a sensor.

## History

Sessions are written to **AsyncStorage** when a workout finishes, or when you end one after a few seconds. Each row stores date, duration, FTP, and whether you completed the plan. Open them from Settings. The home screen does not keep a streak.

There is no sign-in on this path. The workout does not wait on an account. History on the screen is the copy on the phone. If you later sign in from Settings, finished sessions also copy to this app's Supabase project and merge back when the network is there.

### Feedback

Settings → Leave a note. It is optional and free-form. No rating. No account.

When Supabase is configured, Send writes a row to `app_feedback` and tags the install when it can. Anonymous inserts are allowed. Riders cannot read the table. You read notes in the Supabase Table Editor.

The note is stored on the phone first. If the server is missing, it stays in the outbox and sends on a later try.

## Your data

Settings → Your data. Local clears apply immediately. Cloud deletes wait until the phone is online and, for account data, signed in. A failed cloud delete stays queued. The screen says so. It does not claim the cloud copy is gone.

| Action | On this phone | In the cloud |
| --- | --- | --- |
| Delete workout history | Sessions disappear from History | Signed-in sessions that ended before the tap are deleted. Newer rides stay |
| Clear queued notes and analytics | Unsent feedback and analytics are dropped | Rows already delivered stay until account delete |
| Reset defaults | FTP and the session structure return to the defaults | Nothing |
| Erase data on this phone | History, queued notes, analytics, settings, rider name, and the install id | The install row, and the same session delete as history, when the network is there |
| Delete account and cloud data | You are signed out only after the server accepts it | Profile, sessions, analytics, notes, connections, and imports for that rider, then the auth user. Devices stay, with no user attached |

One confirm is required for **Delete account and cloud data**. The other actions run on tap.

Anonymous notes have no user id, so a rider cannot pull them back. Notes sent while signed in are removed with the account.

Account delete does not wipe sessions that are still stored on the phone. Delete workout history does that. If you sign in again later, sessions still on the phone can upload again.

## Cloud

30/15 uses its **own** Supabase project. Create a dedicated project for this app. Do not use the BioAge project. Do not share a Supabase project or tables with any other app.

Without those keys, the app stays fully local. Workouts, notes, analytics, and Start all work.

A second empty project is optional, for staging. Point a separate `.env.local` at it. Do not use the BioAge project for staging either.

1. Create a new Supabase project for 30/15 only.
2. Open the SQL editor and run these in order. Each file is safe to run again.
   - [`supabase/migrations/20260926120000_foundation.sql`](supabase/migrations/20260926120000_foundation.sql)
   - [`supabase/migrations/20260926143000_offline_outbox.sql`](supabase/migrations/20260926143000_offline_outbox.sql)
   - [`supabase/migrations/20260926160000_deletion.sql`](supabase/migrations/20260926160000_deletion.sql)
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

`app_events.properties` holds sparse facts (watts, counts, provider, delivery). It rejects email, names, and feedback text.

Riders can delete their own profile, sessions, events, signed-in notes, connections, and imports. `delete_my_account()` does that in one transaction and then removes the auth user. `delete_my_sessions(cutoff)` deletes sessions that ended at or before a history wipe. `delete_my_device(id)` removes one install row.

`connections.metadata` rejects token-like keys. Real tokens belong in an Edge Function and Supabase Vault, not in a client-readable column.

Owner views `owner_daily_active`, `owner_new_profiles`, `owner_workouts_completed`, and `owner_feedback_daily` are for the SQL editor. The app key cannot read them. There is no counter table. The views aggregate events, profiles, sessions, and notes.

```sql
select * from public.owner_daily_active order by day desc;
select * from public.owner_new_profiles order by day desc;
select * from public.owner_workouts_completed order by day desc;
select * from public.owner_feedback_daily order by day desc;
```

### App management

- One Supabase project for 30/15. Never BioAge, and never another app's tables.
- AsyncStorage is the source of truth. Outboxes flush later. Start, the clock, voice, music, and history do not wait.
- Auth is optional. `devices` and anonymous `app_events` work before login. A profile is upserted on sign-in.
- History lives in `workout_sessions`. Product analytics live in append-only `app_events`. Counts are views, not mutable counters.
- `connections` and `imported_activities` are stubs. Metadata and status only. OAuth tokens belong in an Edge Function and Vault.
- The publishable key is the only key in the app. Row level security is on every table.
- Sync upserts a session by id and keeps the newer `ended_at`. A failed flush stays queued.
- The service role is not in the client. The app does not sell a subscription.

---

## Audio

Rocky lines are spoken, never printed. One welcome just after you start. One line 10–12 seconds into each hard 30, from four takes, never the same line twice in a row. One line in the first 3 seconds of each easy 15, after the opening second, from three takes — about one easy in four stays quiet. The first HARD says “Go.” once. The set break says “Round won. Stay sharp.” The finish line is fixed. Rocky stays quiet from 3 seconds before a change through 1 second after it. Which take plays follows the rep and the start time. It does not move the clock.

Into each HARD, including the first one after the warm-up, three ticks land at 3, 2, and 1. The slots do not move. An approach is rising pitch, rising volume, or two light ticks and a stronger third, then the same go chirp. About one HARD in five after the first skips the ladder and keeps a single warn at T−3 plus the chirp. The first HARD of the session adds one syllable, "Go.", on that chirp, then silence. EASY does not get a beep. There is no spoken count and no caption.

When the last easy of a set opens the set rest, one win chirp plays with "Round won. Stay sharp." The clock punches once and the rail flashes, then the rest breathes cool. The finish line sits on a heavier done beep. The screen blooms once in the go color, then holds. The button says Done.

A generated instrumental bed starts with the ride. Start picks one of three beds for the session. Drive stays hotter under HARD. Recover stays cooler under the fifteens and rest. The HARD glow steps around the same red, once per interval, and crossfades when the interval opens. Home may show a short tip under the structure. About one open in four shows none. Start is always there. The finish title is one of three lines. The button says Done. The bed drops out while Rocky speaks and from T−3 through T+1, then comes back. Settings → Music turns it off. Default is on. Nothing on Home plays the bed before Start. The phone's silent switch still lets the ride play, same as the cues. The bed keeps looping if you leave the app, so the clock and the cues keep their places. See [Background](#background).

The four lines are recorded (a direct neural voice) and played with expo-audio, including when the phone is on silent. If a clip cannot load, the app falls back to the best on-device English voice it can find, pitched slightly down and never faster than a normal speaking rate. Skip, shorten, and restart do not speak.

## During the ride

On warm-up, HARD, and EASY the live watts are the big number at the top. Heart rate sits under them when a watch is sending beats. The countdown is lower, with TIME beside it. While the clock is running, Pause is the only control. Pause becomes Resume. End is there only after you pause, and it asks once.

Watts and heart rate render only from a fresh sensor packet. A dash is an empty link, never a guessed number.

## Power meter

Optional. Start is not gated on a meter or a heart rate watch. Live watts are the top number on the ride when a meter is sending them. The countdown stays underneath.

The primary path is the **Cycling Power Service** (`0x1818`) and **Cycling Power Measurement** (`0x2A63`). Flags are the first two bytes. Instantaneous watts are the next two, a little-endian signed 16-bit. SRAM and Quarq left cranks use this path. Wake the meter with a pedal stroke. **FTMS Indoor Bike Data** (`0x2AD2`, power and speed) is still accepted when a trainer has no cycling power service. Nothing is simulated. Home shows a dash until a packet arrives.

Home and **Settings → Power meter**, before Start: scan, pick, live watts, disconnect. The last peripheral id stays on the phone. The next launch tries that meter and falls back to a scan. Heart rate uses the same remember-and-reconnect path.

**Expo Go and the browser cannot open the radio.** Settings says so, with the same gate copy as a denied permission or a radio that is off. They do not invent watts. Finish hides the pair sheet there. A development build is required to connect a real meter:

```bash
npx expo install expo-dev-client
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

The development profile is in [`eas.json`](eas.json). That EAS iOS device build needs a paid Apple Developer account. A free Apple ID on a physical iPhone is the local Mac + Xcode path: [Install on an iPhone from a Mac](IOS-LOCAL-INSTALL.md).

Install that build (not Expo Go). Open the power chip or Settings → Power meter before Start. Pedal the crank, scan, and connect. Watts appear only after a real measurement packet, large at the top of the ride. Disconnect drops the link and leaves the saved meter. The next launch tries that meter again. Heart rate is the standard service `0x180D` / `0x2A37` (Garmin Fenix Broadcast HR). It is remembered the same way. Start does not wait for either sensor.

`react-native-ble-plx` is already a dependency. Its config plugin adds the iOS Bluetooth usage string and Android scan/connect permissions at prebuild (`neverForLocation`, since this is not a location scan).

---

## Audio cues

Rocky cues are short recordings played with **expo-audio** (not expo-av). **expo-speech** is only the fallback. Rising ticks at T−3, T−2, and T−1 lead only into HARD, then the go chirp. EASY stays quiet. The set-break line and "Go." are recorded the same way. Rocky does not talk over the clock. The beds are short original loops in the app, not a streaming service. Nothing in the ride invents watts.

---

## Background

Leaving the app, or locking the screen, does not pause the ride. Pause still means Pause. The glow and the rail stop moving while another app is in front. The clock does not. Maintainer notes, the catch-up proof, and the platform limits are in [BACKGROUND.md](BACKGROUND.md).

**iOS** mixes with other audio and ducks it only while a cue is already silencing our bed. YouTube keeps playing. There is no lock-screen remote, because that API requires exclusive audio and would pause YouTube for the whole ride.

**Android** takes exclusive audio for a running ride and shows a media notification (segment label, no watts, no seek). Notification pause pauses the workout. Notification play resumes it. YouTube stays paused while the ride is running.

`playsInSilentMode` keeps the ride audible with the iOS silent switch on, and with Android silent or vibrate. Expo Go does not apply this project's native background config. Use a development build. See [BACKGROUND.md](BACKGROUND.md). On a free Apple ID that build is local: [Install on an iPhone from a Mac](IOS-LOCAL-INSTALL.md). The `eas build` commands in [Power meter](#power-meter) are the paid-account path.

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

Power meter, heart rate, workout sets (default 2 × 13), FTP (default 120 W), hard/easy targets, warm-up, reps, work/recover, rest, cool-down, music, speech, haptics. Stored in AsyncStorage. The finish screen's primary button says Done. Neither sensor is required to start. A finished ride's summary is saved on the phone first. If you are signed in, that row also syncs to this app's Supabase project. Done does not wait.

---

## Limitations

- The timer is wall-clock time. While the app is in front, `expo-keep-awake` holds the screen on. In the background the bed (or a silent loop) holds the audio session. If the OS freezes or kills the process, the clock snaps forward on return and does not replay missed cues. See [BACKGROUND.md](BACKGROUND.md).
- History, FTP, notes, and analytics stay on the phone. Cloud sync is a later best-effort flush. Start, the clock, cues, and the music bed do not wait for it.
- Feedback reaches the dashboard only after the SQL has been run and the phone can reach it. Until then the note stays in the outbox.
- A power meter and a heart rate broadcast are optional, from home or Settings before Start, and only in a development build. Expo Go and the browser show why the radio is unavailable. They never show invented watts or heart rate. The Done screen shows sensor stats only when those packets arrived.

---

## Checks

From the repo root:

```bash
npx tsc --noEmit
npm test
```

`npm test` runs the unit tests for the coach, history merge, outbox retry, analytics (no personal data), profile writes, deletion, the offline gates, and background catch-up (wall clock, cue windows, no double-fire). `npx tsc --noEmit` typechecks the app. GitHub Actions runs `npm ci`, then those two commands, on every pull request and on every push to `main`. The YouTube check is on a device. The steps are in [BACKGROUND.md](BACKGROUND.md).
