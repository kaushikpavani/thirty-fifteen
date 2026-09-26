# 30/15 Coach

Expo SDK 57 bike coach for **Rønnestad 30/15** micro-intervals. One number on the workout screen, spoken cues a beat early, and targets from your FTP.

**App name:** 30/15 Coach  
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

- **FTP = 120 W** (asked once, always editable)
- **HARD** = 120% FTP → **144 W**
- **EASY** = 50% FTP → **60 W**

A saved FTP is left alone. Only a fresh install starts at 120 W.

---

## Welcome, account, history

The first screen greets you by time of day. A streak of completed sessions replaces that line. If you are signed in, the name comes from Google or Facebook. Otherwise type one. It stays on the phone.

Sessions are written to **AsyncStorage** when a workout finishes, or when you stop after a few seconds. Each row stores date, duration, FTP, and whether you completed the plan. A streak counts **finished** sessions on consecutive days. Today can still be empty; yesterday’s chain still counts.

### Google and Facebook (Supabase)

Sign-in uses [Supabase Auth](https://supabase.com/docs/guides/auth) with `expo-auth-session` / `expo-web-browser`. That path works in Expo Go. Native Google and Facebook SDKs do not.

1. Create a project at [database.new](https://database.new).
2. Copy `.env.example` to `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is accepted if you still have the older anon key name.

3. In Supabase, enable **Google** and **Facebook** under Authentication → Providers.
   - Google Cloud: create a **Web** OAuth client. Authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Facebook: add the same Supabase callback as a valid OAuth redirect. Development mode only allows test users.
4. Authentication → URL configuration → add the redirect the app shows on the sign-in note. In Expo Go it looks like `exp://127.0.0.1:8081/--/auth-callback`. Also add `thirtyfifteen://auth-callback` for a dev or store build.
5. Open the SQL editor and run [`supabase/workout_sessions.sql`](supabase/workout_sessions.sql).

Restart Expo after changing env vars (`npx expo start`). The session is stored in AsyncStorage, so the rider stays signed in.

Without those env vars the app still rides. Google and Facebook explain what is missing. History stays on the device.

---

## Power meter

The app speaks **FTMS Indoor Bike Data** (`0x2AD2`, power + speed) and the **Cycling Power Measurement** (`0x2A63`, watts only). Speed is shown only when the trainer sends it. Nothing is simulated.

**Expo Go and the browser cannot connect.** Open Settings → Power meter → Connect and the screen says a development build is required.

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

Install that build (not Expo Go). Settings → Power meter → Connect. Wake the trainer, pick it from the list. On the workout screen, **LIVE** watts replace the target as the power readout. The target stays underneath. If the radio drops for more than a few seconds, the screen falls back to target watts.

`react-native-ble-plx` is already a dependency. Its config plugin adds the iOS Bluetooth usage string and Android scan/connect permissions at prebuild (`neverForLocation`, since this is not a location scan).

---

## Audio cues

Spoken cues use **expo-speech**. Beeps use **expo-audio** (not expo-av). They fire about 0.8s early. Beeps mix with other audio and play with the ringer switch off.

---

## Settings

FTP, hard/easy %, warm-up, sets, reps, work/recover, rest, cool-down, speech, voice rate, beeps, haptics, cue lead. Stored in AsyncStorage.

---

## Limitations

- The timer uses wall-clock elapsed time. Keep the screen on (`expo-keep-awake`). If iOS suspends JavaScript, phase timing is best-effort.
- Cloud history sync needs the Supabase table and a signed-in session. Failures stay local and say so.
- Bluetooth needs a development build. Expo Go is honest about that.

---

## Checks

```bash
npx tsc --noEmit
npm test
```
