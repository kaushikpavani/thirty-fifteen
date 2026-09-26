# Background workouts

A running 30/15 keeps its clock and its cues when the rider opens YouTube or locks the screen. The screen does not need to keep drawing. Pause still means pause. This file is the contract for that behavior.

Device audio is not what CI hears. CI runs `npx tsc --noEmit` and `npm test` (`.github/workflows/ci.yml`). The manual script at the bottom is how to confirm a phone, with YouTube in front.

## What stays the same

Cue **times** are the ones in `src/audio/rocky.ts` and `src/audio/spirit.ts`. Variety is which line and which bed, from the session salt. It is not when the line is allowed to speak. Nothing in this path changes those windows.

Offline. No login wall. No watts on the notification.

## Where it lives

| File | Job |
| --- | --- |
| `src/audio/session.ts` | `setAudioModeAsync` for idle, running, and the short iOS duck. |
| `src/audio/cues.ts` | Cue players. Re-exports enter/leave so the engine has one import. Calls `holdForeignDuck` next to `duckMusic`. |
| `src/audio/music.ts` | Looping bed, silent hold when Music is off, Android notification. |
| `src/audio/remoteTransport.ts` | Which notification samples are a real pause or play. |
| `src/workout/wallClock.ts` | Elapsed time from the wall clock. Pause does not accumulate. The playhead never moves backwards. |
| `src/workout/playhead.ts` | One wall-clock sample: the timer and a foreground return both use `planCatchUp`. |
| `src/workout/appPresence.ts` | AppState: `background` rearms audio, `inactive` only snaps the clock. |
| `src/workout/cueCatchup.ts` | Which cues a jump from `fromMs` to `toMs` may play. `takeCue` is the double-fire lock. |
| `src/hooks/useWorkoutEngine.ts` | Wires the clock, the cues, and notification pause/resume. |
| `src/hooks/useAppActive.ts` | Foreground flag. Animations stop off-screen. The workout does not. |
| `app.json` | `UIBackgroundModes: ["audio"]`, `enableBackgroundPlayback: true`. |
| `eas.json` | `development` profile (`developmentClient`, internal). |

`ios/` and `android/` are generated. Do not edit them for this.

## Clock

While the ride is running:

```
elapsed = pausedAccum + (now - anchor)
```

`anchor` is null while paused, so time on the Pause glass does not move the workout. A backwards or non-finite clock returns the accumulated elapsed and does not open old windows.

`nextPlayhead` never returns a smaller value than the previous playhead, and never passes `totalMs`. Seek and the pause button set the cursor themselves. They do not go through that helper.

Pause stores the wall elapsed into the cue cursor and does not deliver cues for that instant. A long pause is not a tick. A window that already ended stays ended. A window that is still open fires once on the next running tick, then the fired set blocks it.

## Catch-up

`cuesDue` is pure. The engine marks a key fired when it plays it. The function will return an open window again until that set is passed back in. That is the double-fire lock. Tests cover a full 30/15 of 100ms flushes: each key once.

Rules, all covered by `src/logic/cueCatchup.test.ts`:

- A window matches the live clock: chirp `[start, start + 400)`, ladder and warn leads of 400ms, Rocky welcome `(1000, 1800]`, hard `[10s, 12s)`, easy `(1s, 3s]`, finish `(1s, 2.2s]`.
- One flush plays at most one chirp, one warn, one ladder rung, and one Rocky line: the latest of each. On a normal 30/15 the 2s gap holds only one of each, so the clock does not move. A 1s custom segment that is jumped in one tick keeps the latest chirp only.
- A boundary chirp drops ladder rungs that already expired.
- Gap `<= 2000` plays a window the playhead crossed. `2001` plays it only when `toMs` is still inside the window. A long suspension does not dump a backlog.
- Rocky text and clip come from `rockyCue` with the same salt. A different salt is a different line. A quiet easy (every fourth, shifted by salt) stays quiet.
- Seek, shorten, and skip set the cursor to the landing time so the jump is not catch-up.

## Audio session

Checked against expo-audio SDK 57 `setAudioModeAsync` and the iOS `AVAudioSession` category `.playback`. These are the modes that exist. They were not invented for this app.

| Mode | Other apps |
| --- | --- |
| `mixWithOthers` | Keep playing. Android requests no audio focus. |
| `duckOthers` | Keep playing, quieter, for as long as our session is playing. |
| `doNotMix` | Pause. Required for `setActiveForLockScreen`. |

The bed loops for the whole ride. Leaving `duckOthers` on would duck YouTube from Start until the end, so iOS does not do that.

**iOS, ride running.** `mixWithOthers`, plus `shouldPlayInBackground`. For the same window that already ducks our bed (T−3 through the first second of HARD, a beep, a Rocky line), the session switches to `duckOthers`, then back to mix. YouTube keeps playing and dips for that window. Lock-screen controls stay off: `setActiveForLockScreen` requires `doNotMix`, which would pause YouTube for the whole ride.

**Android, ride running.** `doNotMix` and `setActiveForLockScreen` (seek hidden). Expo's docs say that without the media session, background playback stops after about three minutes. A 30/15 is longer than that. YouTube pauses while the ride is running. The notification title is the segment label (`Hard 1/13`), artist `30/15`. No watts.

**Paused.** Background mode turns off and the bed pauses, so a paused ride is not holding the session just to stay alive. On Android the notification stays registered, so Play can resume the workout. Stop and finish clear it. If the OS removes the notification when focus is released, resume from the in-app Pause glass.

**Idle**, before Start: mix, and do not play in the background.

`playsInSilentMode: true` uses the playback category. The iOS silent switch does not mute the ride. Android silent and vibrate do not either.

Cue players and bed players set `keepAudioSessionActive`, so a short clip ending does not tear the session down and chop another app.

Bed players use `updateInterval: 250`. That is only the status ticker. It does not move cue times.

### Notification play / pause

Android `playbackStatusUpdate` ticks only while `playing` is true (`BaseAudioPlayer`). A pause is one `playing: false` sample, then the ticker stops. Waiting for a second pause sample would never fire, so pause confirms on that single sample.

Play confirms on two `playing: true` samples (the edge, then the next tick). One blip does not resume the ride. The first sample after the listener attaches is adopted and does not emit play.

`didJustFinish` is not a finger. A looping ExoPlayer (`REPEAT_MODE_ONE`) does not sit in `STATE_ENDED`, and iOS does not emit `didJustFinish` while `loop` is set. A low `currentTime` is not treated as a seam: a real pause in the first fraction of a loop stays at that time, and no second sample would arrive to correct it.

Our own `play()` and `pause()` are ignored for 800ms when the sample matches the command we issued. A sample that disagrees is the rider and still confirms. In-app Pause and notification Pause are the same function.

iOS has no notification remote.

### Interruptions

On iOS, `mixWithOthers` and `doNotMix` both pause our players when an interruption begins (a phone call). Expo resumes them only if the system sends `shouldResume`. This app does not call `play()` on a timer on native. That retry fought the interruption and the notification pause. Web still retries a rejected Start tap.

Coming back to the foreground after a real `background` (not a Control Center `inactive`) re-applies the workout audio mode and kicks the bed if we still think it should be playing. The workout clock is not paused by the call. Cue clips call `play()` when their window arrives.

## App state

`background` / `inactive` do not pause the workout.

Animations (atmosphere, rail, digits) stop when the app is not active, or when Reduce Motion is on. The Pause glass is still the pause button.

Returning from `inactive` only kicks the bed and snaps the clock. Returning from `background` enters workout audio again, then kicks the bed. A stale enter cannot overwrite a leave: each enter/leave bumps a generation, and the audio-mode queue drops work from an older generation.

## Expo Go and a dev build

`UIBackgroundModes` and the Android media foreground service come from the `expo-audio` config plugin (`enableBackgroundPlayback: true` in `app.json`). They are baked in at prebuild. **Expo Go does not apply this project's native config.** Background cues in Expo Go are not the supported path.

```bash
npx expo install expo-dev-client
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

`eas.json` is that development profile. Install the build, not Expo Go. The same build is what the power meter needs.

## Known limits

- The OS can kill a background process. On the next launch the clock is gone with the process. If the process was only frozen, the next tick snaps to wall time and does not replay missed cues.
- Holding an audio session costs battery.
- Haptics often no-op in the background.
- `expo-speech` is the fallback when a clip fails to load. It is not the background path.
- Android notification pause in the same moment as a bed change can be adopted as the listener's first sample and ignored. The in-app Pause glass still works.
- iOS will not show lock-screen transport for this ride, on purpose.

## Automated tests

`src/logic/backgroundRide.test.ts` drives the same helpers the engine calls.

- Wall time, not a count of ticks. A late sample moves the playhead by the real gap.
- A stall of 2.5s snaps forward and does not replay the opening. A stall inside 2s still plays the cue it crossed, once.
- The next tick does not repeat that cue. `takeCue` is what makes the second call empty. Without it, `planCatchUp` would return the open window again.
- `background` then `active` rearms and catch-up runs once, including a return that is still inside a Rocky window.
- `inactive` then `active` (Control Center) snaps and does not re-arm. The stalled cues still play once.
- A paused ride does not catch up when it becomes active.
- A backwards clock does not reopen a cue that already played.
- A return past the end of the workout finishes with an empty cue list.

`src/logic/wallClock.test.ts`, `src/logic/cueCatchup.test.ts`, and `src/logic/remoteTransport.test.ts` cover the pieces underneath: pause accumulation, the 2s gap boundary, salt, and notification play/pause.

## Manual test

Run this on a development build. CI cannot hear the phone.

1. Install the development build on iOS and, if you can, Android.
2. Start a workout. The bed is audible. The silent switch (iOS) or silent/vibrate (Android) does not mute it.
3. Switch to YouTube, or lock the screen, for several HARD/EASY pairs. Stay away for more than a minute, and on Android for more than three.
4. Hear T−3, T−2, T−1, the phase chirp, and Rocky on time. On iOS, YouTube keeps playing and dips under each cue. On Android, YouTube stays paused while the ride is running.
5. Return to 30/15. The countdown matches the time you were away. The ride is not paused. Cues that already played do not play again.
6. Pause in the app. Cues and the bed stop. Wait through a moment where a chirp would have fired. Resume. That chirp does not fire late. The next one does, on time.
7. Android: pause from the notification. Cues stop. Play from the notification. They continue from that second. iOS: the lock screen has no play/pause for this app, and YouTube was not forced silent for the whole ride.
8. Music off. Start again. Leave the app. Cues still arrive. No bed tone.
9. Place a phone call during a ride, hang up, and return to the app. The clock has moved. The bed is audible again after you are back.
