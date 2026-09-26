# 30/15 — App Store listing

Listing plan for **30/15**, a Rønnestad-style 30/15 micro-interval coach. Paste the fenced blocks into App Store Connect. Everything outside a fence is for the owner: locks, art direction, and checks that keep the listing honest.

The name is locked. The product is one session done well: a huge clock, a sparse coach voice, music that moves with HARD and EASY, offline-first, optional account. It is free for good. It is not a generic timer, and it is not a product you pay to keep using.

Bundle ID: `com.kaushikpavani.thirtyfifteen`. Version this plan is written for: **1.0.0**.

---

## Positioning

Owner lock. These four lines govern the product. Supabase and BioAge stay in this file. They never go into App Store Connect.

1. **Guest = phone only.** Not signed in, all data stays on the device. No cloud required.
2. **Signed in = phone + backend sync.** Optional. Sync goes to the dedicated 30/15 Supabase project. Never BioAge.
3. **Never charge money.** No Pro tier. No paywall. No in-app purchase. No upsell. A forever-free tool.
4. **Spirit.** A tool to be better — you can do it. Not streaks, not shame, not monetization.

| | |
|---|---|
| Who it is for | Riders who already know the 30/15 and want the clock, the voice, and the music to carry the set |
| What it is | A focused micro-interval coach. Huge countdown. Sparse grit voice. Music that lifts on HARD and settles on EASY |
| Price | Free. The whole tool. No subscription, no Pro, no paywall |
| Guest | Phone only. History, FTP, and settings stay on the device. No cloud required |
| Signed in | The same phone data, plus sync to the dedicated 30/15 backend. Never a BioAge project |
| Spirit | A tool to be better — you can do it |
| How it fits a real ride | Offline-first. Start with no account. An account is optional, later |
| What it refuses | Generic interval timers, streak guilt, shame, nagging, fake watts, login walls, medical promises, monetization |

Default session the copy may describe, because it is the real plan: warm-up, **3 × 13** of **30s HARD / 15s EASY**, easy spinning between sets, cool-down. HARD defaults to about **120% of FTP**. EASY defaults to about **half**. Both are editable. A fresh install starts at 125 W and does not ask for a sign-in before the first interval.

---

## Copy locks

These apply to the name, subtitle, promo text, description, keywords, screenshot captions, preview video, and What’s New.

- **Name stays 30/15.** Do not expand it, translate it, or append “Coach”, “Timer”, or “Pro” in the store name.
- **No film, character, or celebrity voice claims.** Do not write Rocky, Balboa, or any movie-trademark persona into customer-facing text. In the product the voice is short and spare. On the store it is a coach voice. Nothing else.
- **No medical or cure claims.** No VO₂ promises, no “fixes your fitness”, no treatment language. A coaching timer. Not medical advice. Ride within your limits.
- **No streak guilt and no nagging.** No “don’t break the chain”, no badges that scold a missed day, no daily push to come back.
- **No fake watts.** Planned targets in the description come from the rider’s FTP. Store frames do not show them. A live number appears in the product only after a real power-meter packet, and not in the listing until that is true.
- **No login-wall screenshots.** The first screen is Home and Start. Account is optional and stays off the store frames.
- **Free, for good.** Public copy says free, and no subscription. Banned in customer-facing text: free tier, free trial, free version, upgrade, unlock, Pro, Premium, Subscribe, paywall, restore purchases, in-app purchase.
- **Guest stays on the phone.** Without an account, data stays on the device and the cloud is not required. Signed-in sync is optional and is the only path off the phone. Do not name Supabase or BioAge in store text. Owner side: that sync is the dedicated 30/15 Supabase project, never BioAge.
- **Spirit line.** “A tool to be better — you can do it.” Quiet permission. It belongs in the description. It is not a shouted caption, a badge, or a second button. Not streaks, not shame, not monetization.

---

## War room locks

Unanimous pass. If another line in this file disagrees with this section, this section wins.

**Voice.** Keep the sparse grit. Lines that stay: “sparse coach voice”, “Earn the quiet after.” No cheerleader spam, no Balboa or Rocky trademark, no streak guilt. “Hits on HARD” is product heat — the music and the phase — not a shout at the rider.

**Craft.** Keep the six-shot order. In every frame, kill TARGET and watts, Rocky captions, streak badges, a login wall, and a second call to action. Shot 5: the countdown stays the visual hero. The ears-free line sits in the margin and does not cover the clock. Shot 6: an honest session list only.

**Flow.** “Open. Start. Ride.” stands. Starting without an account is the honest path. Kill any frame where login appears before Start, and any tip or carousel that covers the orange Start pill.

**Power.** Rønnestad 30/15 and offline stay. Kill the live-watt dial, a %FTP hero, and green/red on-target chrome. Until BLE is real, the only color on the clock is phase glow.

**Spirit.** Guest = phone only. No cloud required. Signed in = phone plus sync to the dedicated 30/15 Supabase project, never BioAge. Never charge money: no Pro, no paywall, no IAP upsell. Forever free. The line is “a tool to be better — you can do it.” Not streaks, not shame, not monetization. Kill any freemium wording.

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

“Hits on HARD” means the bed and the phase heat up. It does not cheer the rider on. Ship this sentence only when both claims are true in the build you submit: the music bed actually moves on HARD, and a session keeps running with another app in front. Until then, use the fallback (**133** characters):

```text
Huge countdown. Sparse coach voice. A beep ladder on every edge. 30/15 micro-intervals you can run offline, with no account required.
```

### Description

Paste as plain text. Blank lines are intentional.

```text
30/15 is a coach for one kind of work: Rønnestad-style 30/15 micro-intervals. A huge countdown. A sparse coach voice. Music that moves with HARD and EASY. Not a generic timer.

Free. No subscription. No paywall. The whole tool stays free.

Built for the work.
The session is the classic shape. Short hard efforts, shorter recoveries, repeated. Targets come from your FTP — about 120% on the thirties, about half on the fifteens — and you can change them. A beep ladder marks the edges, a few seconds out and again when the phase flips. The music bed lifts on HARD and settles on EASY. Pause when you need to. Resume, shorten, skip, or end. The clock stays the only hero.

Built for real life.
Open the app and start. No account required. As a guest, everything stays on this phone. No cloud required. The workout runs offline, including while another app is in front. History remembers the work: when you rode, how long, the FTP you used, and whether you finished the plan. Sign in only if you want that same history synced as well. Your data can be deleted.

A tool to be better. You can do it.
No streaks. No shame. No nagging. No fake watts.
A coaching timer. Not medical advice. Ride within your limits.
```

Owner, not for the store: signed-in sync is the dedicated 30/15 Supabase project. Never BioAge. Do not paste either name into App Store Connect.

Same rule as promo text. If the music bed or playback under another app is missing from that binary, take out both music sentences (“Music that moves with HARD and EASY.” and “The music bed lifts on HARD and settles on EASY.”) and the clause “including while another app is in front.” Keep the free and no-subscription lines, the guest-stays-on-the-phone lines, the beep ladder, the FTP targets, pause, offline start, optional account, and the closing spirit line. Leave a feature out rather than describe one the build does not have.

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

Limit 4000. Primary is **172** characters. Fallback is **164**.

```text
30/15 is here. A huge clock for micro-intervals, a sparse coach voice, and music that moves with HARD and EASY. Ride offline. An account is optional. Free. No subscription.
```

Fallback if the music bed is not in 1.0:

```text
30/15 is here. A huge clock for micro-intervals, a sparse coach voice, and a beep ladder on every edge. Ride offline. An account is optional. Free. No subscription.
```

---

## Screenshots

Six frames, in this order. One idea each. The caption sits in the margin, smaller than the clock, and never covers it. Capture the real UI. Crop a real screen rather than draw a new one.

`supportsTablet` is true, so App Store Connect will also ask for iPad. Use the same story and the same restraint. Confirm the required device sizes in App Store Connect at submit time and shoot the largest iPhone size it asks for.

Every frame, no exceptions: no TARGET label, no watt numeral, no %FTP, no Rocky or persona caption, no streak badge, no login wall, no second button, no price, no Pro mark, no paywall.

### 1 — Hero HARD

- **Caption:** The clock you can feel
- **On screen:** An in-progress HARD interval. The remaining seconds are the largest type on the phone. Phase label reads HARD. Warm phase glow behind the number. Nothing else.
- **Color:** HARD `#FF453A` as glow on `#070708`. Phase glow only.

### 2 — EASY recovery

- **Caption:** 15 seconds to come back
- **On screen:** The fifteen. Same giant clock. Cool phase glow, so the recovery reads as recovery.
- **Color:** EASY `#64D2FF` as glow. Phase glow only.

### 3 — Home, Start

- **Caption:** Open. Start. Ride.
- **On screen:** The orange Start pill, clear. No login before it. No tip, carousel, or coach line covering it. No second button beside it or under it. FTP, %FTP, and watt targets stay out of this frame — crop them off if the live Home leads with them.
- **Color:** Start `#FF7A1A`. Dark glass, empty space around the pill.

### 4 — Finish

- **Caption:** Earn the quiet after
- **On screen:** Done. The bloom after the last interval. One quiet end. No share sheet, no second button, no badge.
- **Color:** The quiet done bloom, `#30D158`, on the dark ground. That green is the end of the session, not an on-target lamp.

### 5 — Ears free

- **Caption:** Coach in your ears. Eyes free.
- **On screen:** The countdown is still the hero, same scale as shots 1 and 2. The ears-free line is the story, set in the margin, and it does not sit on the number or outrank it. Voice and music are why the rider can look up. The picture remains the clock.
- **Leave out:** a waveform, a music-app logo, a celebrity, a persona name, and any caption treatment larger than the countdown.

### 6 — History

- **Caption:** Your work, remembered
- **On screen:** The session list only. Day, duration, finished or stopped. That is the whole frame.
- **Leave out:** watts, %FTP, TARGET, charts, calories, badges, and a sign-in gate. An empty state is a second crop, never the only history frame.

### Art direction

- Ground: `#070708`. Cards barely lighter. Borders are hairlines.
- Type: huge, light weight, tabular figures on the clock. One caption per frame, in the margin.
- HARD glows warm (`#FF453A`). EASY glows cool (`#64D2FF`). Start is orange (`#FF7A1A`) and is the only action on the Home frame.
- Until a real BLE meter is in the build, do not add a live-watt dial, a %FTP hero, or green/red on-target chrome. Color means the phase.
- Dark glass, glow as atmosphere, negative space doing as much work as the type.
- Status bar clean. No debug banners, no Expo chrome, no “cloud table missing” notes.

### Kill list

Do not ship a frame that contains any of these:

- TARGET, watts, %FTP, a live-watt dial, or green/red “on target” chrome
- A second call to action, or a tip or carousel over the orange Start pill
- Login, sign-up, or any account step before Start
- Rocky captions, a film character, or cheerleader lines (“you got this”, “crush it”, and the like)
- Streaks, flames, badges, or guilt copy
- Tiny type, or a settings dump of every field
- Competitor logos, trainer brands, or another app’s UI
- Medical claims or a heart-rate promise
- A price, a Pro or Premium badge, Subscribe, Unlock, a trial, a paywall, or any freemium line (“free version”, “upgrade to keep”, “Pro riders”)
- BioAge, a shared backend, or a frame that says a guest must reach the cloud
- The spirit line shouted, badged, or used as a second call to action. It stays in the description

---

## App preview (optional)

15–30 seconds. No voiceover that names a persona. Music from the product bed, ducked under one coach line if a line is used. End on the wordmark **30/15** and nothing else.

| Time | Picture | Sound |
|---|---|---|
| 0–3s | Home. Orange Start pill, clear. Finger presses it. | Quiet |
| 3–10s | HARD. Giant countdown, warm phase glow. | Music hits — the bed, not a cheer. One short coach line, then silence |
| 10–16s | EASY. Cool phase glow. Fifteen seconds. | Music settles. Beep at the edge |
| 16–22s | Eyes up. If the phone is in frame, the countdown is still the hero. | Bed only |
| 22–27s | Done, then one honest history row. No watts on it. | Bed fades |
| 27–30s | Wordmark on `#070708`. | Out |

Same frame kills as the stills: no login before Start, no tip over the pill, no second button, no TARGET, no watt dial, no %FTP, no green/red on-target chrome, no streak, no persona, no price, no paywall. Cut the eyes-up shot before any claim that audio continues under another app, unless that build actually does it.

---

## Privacy nutrition labels

High-level answers for App Store Connect. This is not a completed questionnaire. Read the form against the binary you submit and a real privacy policy. Apple’s labels change; the posture below should not.

**Category of the product:** health and fitness coaching. It is a timer and a log, not a medical device, and it does not claim to diagnose, treat, or cure anything.

**Guest = phone only**

- Not signed in, all data stays on the device. No cloud required. Say that on the form.
- Workout history (date, duration, FTP, planned targets, completed or stopped) is stored locally.
- FTP, interval structure, and audio preferences are stored locally.
- The session runs with no network. Offline is the normal case.
- No account is required to start, finish, or read that history.
- The app does not charge. No subscription, no in-app purchase. Do not declare a paid tier.

**Signed in = phone + backend sync**

- Sign-in is optional and can happen after they have already ridden.
- The account may then hold the same session history, plus whatever the auth provider gives you (typically an email and a user id).
- That sync is the dedicated 30/15 Supabase project. Never BioAge. BioAge is an owner ban, not a name for the privacy form.
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
- [ ] Promo, description, What’s New, captions, and the preview contain no film character, no celebrity, no cheerleader line, no medical claim, no streak, no shame, no fake watts, no freemium wording.
- [ ] Description says free and no subscription. Guest copy says data stays on the phone. Supabase and BioAge appear only as owner locks, never in a paste block.
- [ ] “Hits on HARD” still reads as music and phase heat.
- [ ] Music-bed lines and “another app in front” are still true of this binary. If they are not, the fallbacks in this file are the ones that ship.
- [ ] Screenshots are the six-shot order, from the real app. Every frame is free of TARGET, watts, %FTP, a second button, Rocky captions, streak badges, and a login wall.
- [ ] Shot 3: orange Start is clear. No login before it. No tip or carousel on the pill. The frame shows start-without-account.
- [ ] Shot 5: the countdown is larger than the ears-free caption. Shot 6: the session list only.
- [ ] Clock color is phase glow only, until a real BLE meter is in the build.
- [ ] iPad frames exist, because the app supports iPad.
- [ ] “Your data can be deleted” matches a control in the build, local and cloud.
- [ ] Support URL is live. Privacy Policy URL is live if anything leaves the phone.
- [ ] Keywords were tuned once in App Store Connect and still avoid competitor names.
