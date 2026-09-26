# 30/15 — App Store listing

Listing plan for **30/15**, a Rønnestad-style 30/15 micro-interval coach. Paste the fenced blocks into App Store Connect. Everything outside a fence is for the owner: locks, art direction, and checks that keep the listing honest.

The name is locked. The product is one session done well: a huge clock, a sparse coach voice, music that moves with HARD and EASY, offline-first, optional account. It is not a generic timer.

Bundle ID: `com.kaushikpavani.thirtyfifteen`. Version this plan is written for: **1.0.0**.

---

## Positioning

| | |
|---|---|
| Who it is for | Riders who already know the 30/15 and want the clock, the voice, and the music to carry the set |
| What it is | A focused micro-interval coach. Huge countdown. Sparse grit voice. Music that lifts on HARD and settles on EASY |
| How it fits a real ride | Offline-first. Start with no account. History is saved on the phone. An account is optional, later |
| What it refuses | Generic interval timers, streak guilt, nagging, fake watts, login walls, medical promises |

Default session the copy may describe, because it is the real plan: warm-up, **3 × 13** of **30s HARD / 15s EASY**, easy spinning between sets, cool-down. HARD defaults to about **120% of FTP**. EASY defaults to about **half**. Both are editable. A fresh install starts at 125 W and does not ask for a sign-in before the first interval.

---

## Copy locks

These apply to the name, subtitle, promo text, description, keywords, screenshot captions, preview video, and What’s New.

- **Name stays 30/15.** Do not expand it, translate it, or append “Coach”, “Timer”, or “Pro” in the store name.
- **No film, character, or celebrity voice claims.** Do not write Rocky, Balboa, or any movie-trademark persona into customer-facing text. In the product the voice is short and spare. On the store it is a coach voice. Nothing else.
- **No medical or cure claims.** No VO₂ promises, no “fixes your fitness”, no treatment language. A coaching timer. Not medical advice. Ride within your limits.
- **No streak guilt and no nagging.** No “don’t break the chain”, no badges that scold a missed day, no daily push to come back.
- **No fake watts.** Planned targets on Home come from the rider’s FTP. A live number appears only after a real power-meter packet. Never invent a wattage for a screenshot.
- **No login-wall screenshots.** The first screen is Home and Start. Account is optional and stays off the store frames.

---

## Metadata

Limits below are Apple’s current App Store fields. Re-check them in App Store Connect before submit; the fences already fit.

Suggested category: **Health & Fitness**, secondary **Sports**.

### Name

Limit 30. This string is 5.

```text
30/15
```

### Subtitle

Limit 30. Primary is 26 characters.

```text
30/15 micro-interval coach
```

Alternates, if the primary is rejected or feels redundant with the name:

| Subtitle | Chars |
|---|---|
| Bike intervals. Real focus. | 27 |
| HARD 30. Easy 15. Repeat. | 25 |

Use one. Do not rotate them in What’s New.

### Promotional text

Limit 170. This string is **136** characters. Promo text can change without a new binary.

```text
Huge countdown. Sparse coach voice. Music that hits on HARD. 30/15 micro-intervals you can run offline — even with another app in front.
```

Ship this sentence only when both claims are true in the build you submit: the music bed actually moves on HARD, and a session keeps running with another app in front. Until then, use the fallback (**133** characters):

```text
Huge countdown. Sparse coach voice. A beep ladder on every edge. 30/15 micro-intervals you can run offline, with no account required.
```

### Description

Paste as plain text. Blank lines are intentional.

```text
30/15 is a coach for one kind of work: Rønnestad-style 30/15 micro-intervals. A huge countdown. A sparse coach voice. Music that moves with HARD and EASY. Not a generic timer.

Built for the work.
The session is the classic shape. Short hard efforts, shorter recoveries, repeated. Targets come from your FTP — about 120% on the thirties, about half on the fifteens — and you can change them. A beep ladder marks the edges, a few seconds out and again when the phase flips. The music bed lifts on HARD and settles on EASY. Pause when you need to. Resume, shorten, skip, or end. The clock stays the only hero.

Built for real life.
Open the app and start. No account required. The workout runs offline, including while another app is in front. History remembers the work: when you rode, how long, the FTP you used, and whether you finished the plan. An account is there if you want one later. Your data can be deleted.

No streaks. No nagging. No fake watts.
A coaching timer. Not medical advice. Ride within your limits.
```

Same rule as promo text. If the music bed or playback under another app is missing from that binary, take out both music sentences (“Music that moves with HARD and EASY.” and “The music bed lifts on HARD and settles on EASY.”) and the clause “including while another app is in front.” Keep the beep ladder, the FTP targets, pause, offline start, optional account, and the closing line. Leave a feature out rather than describe one the build does not have.

### Keywords

Limit 100, comma-separated. Apple counts spaces, so this draft has none. **91** characters, about nine left to tune. Do not repeat the app name.

```text
interval,bike,cycling,ftp,vo2,trainer,indoor,hiit,workout,countdown,erg,spin,micro,recovery
```

Tune notes:

- Prefer words a rider types: interval, ftp, indoor, trainer, hiit, erg.
- `vo2` is a topic word for the session style. It is not a promise that the app measures VO₂.
- Do not stuff competitor names, device brands, or other apps (no Zwift, TrainerRoad, Sufferfest, Wahoo, Garmin, Peloton, or similar).
- Do not add film titles, character names, “streak”, “watts” as bait, or medical terms.
- Singular and plural are redundant. Pick one.

### What’s New — 1.0

Limit 4000. Primary is **149** characters.

```text
30/15 is here. A huge clock for micro-intervals, a sparse coach voice, and music that moves with HARD and EASY. Ride offline. An account is optional.
```

Fallback if the music bed is not in 1.0 (**141** characters):

```text
30/15 is here. A huge clock for micro-intervals, a sparse coach voice, and a beep ladder on every edge. Ride offline. An account is optional.
```

---

## Screenshots

Six frames. One idea each. Caption sits in the negative space, large, and never competes with the clock. Capture the real UI. Do not composite a fake screen.

`supportsTablet` is true, so App Store Connect will also ask for iPad. Use the same story and the same restraint. Confirm the required device sizes in App Store Connect at submit time and shoot the largest iPhone size it asks for.

Order is the store order.

### 1 — Hero HARD

- **Caption:** The clock you can feel
- **On screen:** An in-progress HARD interval. The remaining seconds are the largest type on the phone. Warm glow behind the number. Phase label reads HARD. Almost nothing else.
- **Color:** HARD red `#FF453A` on `#070708`, glow kept soft.

### 2 — EASY recovery

- **Caption:** 15 seconds to come back
- **On screen:** The fifteen. Cool blue. Same giant clock, quieter light. The rider can see it is recovery, not a second hard effort.
- **Color:** EASY `#64D2FF`.

### 3 — Home, Start

- **Caption:** Open. Start. Ride.
- **On screen:** Home. FTP, HARD and EASY targets, one orange Start. No account prompt, no streak, no modal.
- **Color:** Start `#FF7A1A`. Dark glass, lots of empty space.

### 4 — Finish

- **Caption:** Earn the quiet after
- **On screen:** Done. The bloom after the last interval. No confetti, no share sheet, no “share your streak”.
- **Color:** The done state already in the app, calm green `#30D158`, still on the dark ground.

### 5 — Audio, eyes free

- **Caption:** Coach in your ears. Eyes free.
- **On screen:** The ride itself. Phone in a pocket, on the bar, or face-down is fine if the clock is still the product. The frame should say the voice and the music are doing the work so the rider can look up.
- **Do not show:** a waveform toy, a music-app logo, a celebrity, or a caption that names a voice persona.

### 6 — History

- **Caption:** Your work, remembered
- **On screen:** A short, honest list. Day, duration, FTP, finished or stopped. Empty-state copy is acceptable for a second crop, not for the only history frame.
- **Do not show:** streaks, calories, invented power charts, or a sign-in gate.

### Art direction

- Ground: `#070708`. Cards barely lighter. Borders are hairlines, not boxes.
- Type: huge, light weight, tabular figures on the clock. Captions are short enough to read at arm’s length.
- HARD is warm (`#FF453A`). EASY is cool (`#64D2FF`). Start is orange (`#FF7A1A`) and is the only saturated action color on Home.
- Dark glass, glow used as atmosphere, negative space doing as much work as the type.
- Status bar clean. No debug banners, no Expo chrome, no “cloud table missing” notes.

### Kill list

Do not ship a frame that contains any of these:

- Tiny type, or a settings dump of every field
- A login, sign-up, or “create account to continue” wall
- Streaks, flames, badges, or guilt copy
- Competitor logos, trainer brands, or another app’s UI
- Fake BLE watts, a simulated power trace, or a number that is not the FTP target or a real meter packet
- Medical claims, heart-rate promises, or a film character

---

## App preview (optional)

15–30 seconds. No voiceover that names a persona. Music from the product bed, ducked under one coach line if a line is used. End on the wordmark **30/15** and nothing else.

| Time | Picture | Sound |
|---|---|---|
| 0–3s | Home. Orange Start. Finger presses it. | Quiet |
| 3–10s | HARD. Giant countdown, warm glow. | Music hits. One short coach line, then silence |
| 10–16s | EASY. Cool blue. Fifteen seconds. | Music settles. Beep at the edge, not a speech |
| 16–22s | Eyes up. The phone is not the subject; the clock still reads if it is in frame. | Bed only |
| 22–27s | Done, then one history row. | Bed fades |
| 27–30s | Wordmark on `#070708`. | Out |

Cut the eyes-up shot before any claim that audio continues under another app, unless that build actually does it. No wattage overlay. No login. No streak.

---

## Privacy nutrition labels

High-level answers for App Store Connect. This is not a completed questionnaire. Read the form against the binary you submit and a real privacy policy. Apple’s labels change; the posture below should not.

**Category of the product:** health and fitness coaching. It is a timer and a log, not a medical device, and it does not claim to diagnose, treat, or cure anything.

**On the phone, without an account**

- Workout history (date, duration, FTP, planned targets, completed or stopped) is stored locally.
- FTP, interval structure, and audio preferences are stored locally.
- The session runs with no network. Offline is the normal case.
- No account is required to start, finish, or read that history.

**If the rider chooses an account**

- Sign-in is optional and can happen after they have already ridden.
- The account may then hold the same session history, plus whatever the auth provider gives you (typically an email and a user id).
- Say so on the label as data linked to the user. Do not mark tracking unless you actually track across other companies’ apps. This plan has no ads and no cross-app tracking.

**Deletion**

- The public description says data can be deleted. Only submit that sentence when the binary can do it: clear local history on device, and delete the account’s cloud sessions (and the account, if you offer one).
- Until that control exists, do not answer the privacy form as if deletion is self-serve.

**Not collected**

- No HealthKit in this plan. Do not tick Health records.
- Bluetooth, if a power meter is in the build, is for reading a trainer or bike computer the rider pairs. It is not a location scan. Do not show or claim a wattage the meter did not send.
- No microphone recording. Spoken cues play out; they are not captured from the rider.
- No precise location, contacts, photos, or payment data in this plan.

**Privacy Policy URL** is required once any data leaves the device (optional account, synced history, or feedback sent to you). Placeholder until the owner publishes one:

```text
https://example.com/30-15/privacy
```

Replace `example.com` before submit. Do not leave the placeholder in App Store Connect.

---

## URLs to fill

Owner fills all three. None of them are wired yet.

| Field | Placeholder | Notes |
|---|---|---|
| Support URL | `https://example.com/30-15/support` | Required. A page with a contact path is enough. |
| Marketing URL | `https://example.com/30-15` | Optional. Use it only if the page matches this listing. |
| Privacy Policy URL | `https://example.com/30-15/privacy` | Required if account, sync, or uploaded feedback ships. |

Copyright line, on the age-rating and app-information forms: the owner’s name.

---

## Before you submit

- [ ] Name is exactly `30/15`. Subtitle is one of the three lines above.
- [ ] Promo, description, What’s New, captions, and the preview contain no film character, no celebrity, no medical claim, no streak, no fake watts.
- [ ] Music-bed lines and “another app in front” are still true of this binary. If they are not, the fallbacks in this file are the ones that ship.
- [ ] Screenshots are the six-frame story, in order, from the real app. Home has Start, not a login wall.
- [ ] iPad frames exist, because the app supports iPad.
- [ ] “Your data can be deleted” matches a control in the build, local and cloud.
- [ ] Support URL is live. Privacy Policy URL is live if anything leaves the phone.
- [ ] Keywords were tuned once in App Store Connect and still avoid competitor names.
