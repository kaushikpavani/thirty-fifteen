# Quality: what is tested, and what is not

Run everything with `npm run check`. GitHub runs the same checks on every push to `main`.

Two kinds of tests:

- **Unit tests** check one piece of logic at a time (ride summary, sync planning, VO₂max, cue timing, …).
- **Scenario simulations** (`src/logic/scenarios.test.ts`, `src/storage/*.test.ts`) run whole rides and
  whole lifetimes of data through the real logic with awkward inputs, and check that the app's promises
  hold whatever the settings, sensors, interruptions or ordering.

## Simulated automatically

| Scenario | What is checked |
| --- | --- |
| Every combination of settings (1–6 sets, 4–20 reps, 15–60 s hard, 10–30 s easy, all warm-up, rest and cool-down lengths) | The session builds, durations add up, every part has a unique id |
| A full ride for each of those | Every part chirps once, every hard rep gets its count-in, no cue ever plays twice, every spoken line has a recording for those exact settings |
| Phone locked or app in the background, clock stalling for up to five minutes | No cue doubles, nothing piles up when the app wakes |
| Battery dies, app crashes, or iOS closes the app mid-ride | The ride is checkpointed every 10 s and recovered as "ended early" on the next launch; never duplicated; a finished ride is never replaced by its checkpoint |
| Ending a ride by hand at any point | Before the last hard rep is finished the rider is asked Save or Delete; after it (cool-down) the ride just saves; a few seconds in, nothing is kept or asked |
| Choosing Delete for a ride ended part-way | Gone from the phone at once; a checkpoint that lands late cannot bring it back; never uploaded, and removed from the account if a copy got there; other rides untouched |
| Battery dies while the Save-or-Delete question is showing | The ride is kept |
| No sensors, power only, heart rate only, both | A clean ride record, a verdict and a share card every time; no VO₂max claim without heart rate |
| Heart-rate monitor or power meter drops out mid-ride, connects late, or sends rubbish (NaN, negative, absurd values) | No bad numbers reach the saved ride, the verdict or the share card |
| Updating the app over rides saved in the old storage format | All rides kept, in order, on every launch |
| Storage failing one write in five | A ride confirmed saved is never lost; a failed write never damages other rides |
| A failed or damaged read | Nothing is written or removed because of it |
| Deleting the app, reinstalling, signing in with the same account | Every backed-up ride comes back with all its stats, unchanged, newest first; damaged cloud rows are skipped without stopping the rest |
| Two phones signed in to one account | Both end up with every ride; neither overwrites the other; same-day rides stay separate |
| A ride deleted on one phone | It never comes back on that phone, online or offline |
| Old settings from earlier versions (old voice names, unknown language) | Fall back to current defaults |
| Deleting the app, reinstalling, signing in with the same account: settings | FTP, age, sex, weight, resting heart rate, the workout layout, coach and music choices all come back; the fresh install's defaults never overwrite the account |
| Changing a setting, online or offline | It is sent to the account within seconds, or waits and goes on the next sync; nothing else in the account is disturbed |
| Two phones changing different settings | Each setting ends up as the last one changed; neither phone wipes the other's changes |
| Damaged or out-of-range values in the account | Ignored field by field; the phone keeps its own value |

## Protected by design, checked on the server

- **Two different people on two phones** cannot touch each other's rides: every cloud row is tied to its
  owner and the database rejects reads and writes from anyone else (row-level security in
  `supabase/migrations`). This is enforced by the database, not simulated here.

## Not simulated: check on a real iPhone before each release

These depend on iOS, Bluetooth or audio hardware and cannot run in the test suite.

- [ ] Settings → Sound: tap Sarah, then Chris. Each speaks in its own recorded voice and no red line appears. (A read-only `playbackRate` on the real player broke this once; the tests use a stand-in that behaves the same way, but only the phone proves it.)
- [ ] Pause in the first set, hold to end: Save / Delete / Keep riding appear; Delete leaves nothing in Past rides.
- [ ] Sign in on a fresh install: FTP, profile and coach choice come back from the account.
- [ ] Start a ride, lock the phone for five minutes: cues keep coming, clock is right on unlock.
- [ ] Start a ride, force-quit the app at ~3 minutes, reopen: the ride is in Past rides as "Ended early".
- [ ] Let the battery or a phone call interrupt a ride: same result.
- [ ] Ride with no sensors; with heart rate only; with power only; with both.
- [ ] Turn the heart-rate strap off mid-ride and on again: reading goes blank, then returns; the ride saves.
- [ ] Walk the power meter out of range mid-ride: same.
- [ ] Coach voice (both coaches) and each music genre are audible, and music dips under the coach.
- [ ] Ride with headphones, with the silent switch on, and with other audio (a podcast) playing.
- [ ] Sign in on a second phone with the same account: rides appear on both.
- [ ] Delete one ride: gone on the phone and, after a moment online, from the cloud.
- [ ] Install a new build over an old one: every past ride is still there.
- [ ] Delete the app, reinstall, sign in: every ride that showed as backed up is back, with its charts.
- [ ] Airplane mode for a whole ride: it saves, and backs up when the connection returns.

## Known gaps

- **Shared phone, two accounts.** Rides belong to the phone. If one person signs out and another signs in,
  the second sees the first person's rides on that phone (they cannot be uploaded into the wrong account's
  existing rides, but new ones would back up to whoever is signed in).
- **Deleting a ride with a second phone signed in.** The other phone still holds the ride and will back it
  up again; it stays deleted on the phone that deleted it.
- **Rides never backed up are not restorable.** A ride done signed out or offline lives only on the phone until a
  sync succeeds. Deleting the app before then loses it. Past rides shows how many are still waiting.
- **Screens and gestures** have no automated tests. They are checked by hand in the web preview and on device.
- **The audio generators** are tested with a simulated ElevenLabs API, not the live one.
