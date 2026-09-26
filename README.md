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

## Free

This coach is free. There is no Pro tier, no paywall, and no in-app purchase. The point is the ride.

---

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

## Checks

```bash
npx tsc --noEmit
npm test
```

GitHub Actions runs the same two commands on pull requests and on pushes to `main`.
