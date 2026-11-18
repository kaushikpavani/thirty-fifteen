# Android: build and ship 30/15 Coach

The iPhone app in review is unchanged: home screen name **30/15**, bundle id `com.kaushikpavani.thirtyfifteen`, background audio and Bluetooth modes as they are. This page is the Android path. The launcher name is **30/15 Coach**. The package id matches the iOS bundle id.

The app is free. There is no paywall. Start works with no account, no sensor, and no network. Rides stay on the phone until the rider signs in.

Do not put secret values in git. The service role key never goes in the app or in EAS env.

## What the project already sets

| Piece | Value |
|---|---|
| Package | `com.kaushikpavani.thirtyfifteen` |
| versionName | `expo.version` in `app.json` (`1.0.0`) |
| versionCode | `android.versionCode` is `1` for a local build. EAS `appVersionSource` is `remote` and preview/production set `autoIncrement`, so cloud builds take the next remote Android versionCode. The local `1` only seeds that counter. |
| Launcher name | `30/15 Coach`, from `plugins/withAndroidLabel`. `expo.name` stays `ThirtyFifteen` so the Xcode target is not a number. |
| Icon | Adaptive icon from `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, background `#070708` |
| Splash | `expo-splash-screen` with `assets/splash-icon.png` on `#070708` |
| Deep link | `thirtyfifteen://auth-callback` |
| Backup | `android.allowBackup` is false. A signed-out ride is not copied to the rider's Google account by Android backup. |

`ios/` and `android/` are generated. Do not edit them. Change `app.json` and the plugins.

## Local development

This repo uses npm and `package-lock.json`. From a checkout:

```bash
npm install
npx expo start
```

Expo Go cannot run this app's Bluetooth stack or the media foreground service. Use a development build:

```bash
npx expo run:android
```

That needs Android Studio, a device or emulator, and a USB debugging session on a physical phone for Bluetooth and for screen-off audio. An emulator can confirm the launcher name, sign-in UI, and Back button. It cannot confirm a power meter.

`npm run check` is typecheck, lint, and the full test suite, including the Android permission plan, audio-focus choice, and manifest shaping. It does not install an APK.

## EAS

`eas.json` keeps the iOS profiles. Android is added beside them:

| Profile | Android artifact | iOS |
|---|---|---|
| `development` | APK, dev client, internal | unchanged |
| `preview` | APK, internal, versionCode auto-increments | unchanged |
| `production` | Android App Bundle (AAB) for Play, versionCode auto-increments | unchanged, still submits to team `9R7M4ATZJ8` / app `6835283825` |

The Expo project id in `app.json` is `5fe5855e-1f9e-417f-b31d-abf10c597958`. `owner` stays `pavanikaushik` because that is the account this project is linked to, and the iOS 1.0.0 build in review uses it. The Expo team slug is **pavanikaushiks-team**. Do not change `owner` and do not transfer the project while 1.0.0 is in App Store review. After review, if the team should own the project, transfer it in the Expo dashboard and only then change `owner` to `pavanikaushiks-team`.

Log in with the Expo account that can see that project (the same account as the iOS builds, on team pavanikaushiks-team):

```bash
npx eas-cli login
```

Put the 30/15 Supabase URL and publishable key on the environments you will build. `.env.local` does not reach EAS. Do not use the service role key. Do not commit the commands after you paste the real values.

```bash
npx eas-cli env:set preview --name EXPO_PUBLIC_SUPABASE_URL --value 'https://YOUR_30_15_PROJECT.supabase.co' --type string --visibility plaintext --non-interactive
```

```bash
npx eas-cli env:set preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value 'YOUR_PUBLISHABLE_KEY' --type string --visibility plaintext --non-interactive
```

Repeat both with `production` in place of `preview` if those variables are not already set for the iOS production environment. `env:list --environment production` should show both names.

Internal APK:

```bash
npx eas-cli build --platform android --profile preview
```

Play AAB:

```bash
npx eas-cli build --platform android --profile production
```

The first cloud build with `autoIncrement` stores a remote versionCode. If you want the first Play upload to be a specific number, set it before that build:

```bash
npx eas-cli build:version:set
```

Choose Android, then the versionCode the next build should start from. Leave the iOS build number alone.

Install the preview APK from the EAS build page, or with `npx eas-cli build:run --platform android --profile preview` once a build exists. A production AAB does not install by tapping a file. It goes through Play.

## Bluetooth

iOS asks for Bluetooth only after Connect, with the sentence `30/15 reads cycling power and heart rate from your sensors.` That string is unchanged.

Android:

- API 31 and newer (Android 12+): runtime `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`. The scan permission is `neverForLocation`. The app does not request location on these versions.
- API 30 and older: runtime fine location, because those versions will not scan for Bluetooth without it. API 28 and older also ask for coarse location. The manifest caps both location permissions at `maxSdkVersion` 30, with `tools:replace`, so the BLE library's unrestricted declaration does not survive the manifest merge. The app does not read a position.
- `ACCESS_BACKGROUND_LOCATION` and `RECORD_AUDIO` are blocked.
- `android.hardware.bluetooth_le` is not required. A phone without Bluetooth can still be installed, and Start still works.
- Connect shows an in-app explanation first. Not now never opens the system dialog. A denial or a permanent block explains that the ride still starts, and a permanent block can open system settings. A reconnect while a ride is running does not raise that dialog again.
- Power is Cycling Power `0x1818`, with FTMS `0x1826` only when a trainer has no cycling power service. Heart rate is `0x180D`. The last sensor id is saved on the phone and restored on the next open. Nothing about Start checks for a sensor.

## Background ride

iOS keeps the ride alive with `UIBackgroundModes` `audio` and `bluetooth-central`. The session mixes, and ducks other apps only during a cue.

Android has no background-audio mode. `expo-audio` with `enableBackgroundPlayback: true` adds:

- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- a service `expo.modules.audio.service.AudioControlsService` with `android:foregroundServiceType="mediaPlayback"`

`setActiveForLockScreen` starts that service when the ride starts and clears it when the ride pauses or ends. Expo's sample pairs that call with `doNotMix`, which pauses other apps. This app uses `duckOthers` for the whole Android ride (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`). YouTube keeps playing, quieter, including with the screen off. The ongoing notification title is the segment (`Hard 1/13`). The artist is `30/15 Coach`. There are no watts on it. Pause and play on the notification are the same functions as the in-app Pause glass. There is no notification-permission prompt. The media foreground-service notification is the ongoing item.

The clock is the same wall clock as iOS. Leaving the app does not pause the workout.

## Sign-in

Guests stay fully functional and offline-first.

Continue with Apple is not shown on Android. `signInProviders('android')` is Google only, and the Apple button is not mounted. iOS still shows Continue with Apple first, then Continue with Google.

Google uses the existing Supabase browser flow (`signInWithOAuth` plus the system browser) and returns to `thirtyfifteen://auth-callback`. The Android manifest has an intent filter for scheme `thirtyfifteen` and host `auth-callback`.

Settings → Your data → Delete account and cloud data calls the same `delete-account` Edge Function as iOS. It does not check the platform. The second button on Android says Delete account and phone data and clears this phone as well. The iOS button text stays Delete account and iPhone data.

## Google Play Console

Do these by hand. The repo cannot create the Play listing.

1. Use a Play Console account that can ship a new app. For a personal account created after the November 13, 2023 policy, production access is locked until a closed test has run. See the next section.
2. Create the app. Package name `com.kaushikpavani.thirtyfifteen`. App name `30/15 Coach`. Default language English. App, not a game. Free.
3. Finish the dashboard tasks Play lists before you can release: App content (privacy policy, ads, content rating, target audience, news, data safety), store listing, and countries.
4. Privacy policy URL: `https://kaushikpavani.github.io/thirty-fifteen/privacy/`
5. Support URL: `https://kaushikpavani.github.io/thirty-fifteen/support/`
   Data deletion URL, in the Data safety form: `https://kaushikpavani.github.io/thirty-fifteen/support/#delete-your-data`
   That section names 30/15 Coach and Kaushik Pavani, the in-app steps for one ride, all rides, and the account, what is deleted and what is kept, and a GitHub issue path for someone who uninstalled the app.
6. Declare that the app does not contain ads and has no in-app purchases.
7. Content rating: fitness / health-style activity, no violence, no user-generated public sharing, no location sharing. Answer the questionnaire from the real app. It is a workout timer with optional Bluetooth sensors and optional sign-in.
8. Upload the production AAB to the **closed testing** track first, not straight to production. Create a closed testing release, add the AAB, and roll it out to a tester list.

You can also submit later with EAS once a Google service account is set up (Play Console → API access → a service account with release permission, JSON key stored as an EAS secret, not in git). `eas.json` does not name an Android submit track yet, so the first upload is the Play Console button. iOS submit is unchanged.

### Closed testing for a new personal account

Google requires this before a personal account created after November 13, 2023 can apply for production:

- At least **12 testers** opted in (not merely invited).
- They stay opted in for **14 days** continuously.
- Then, in Play Console, apply for production access. The review of that application is separate from the 14 days.

Recruit people who will actually install from the closed-test link and open the app. A tester who never opts in does not count. Keep the same release installed for those 14 days. A new AAB during the window is fine. Dropping below 12 opted-in testers restarts the clock.

Organization accounts are not under this 12-tester rule. If this Play account is an organization, you can still use a closed test, and you do not have to wait 14 days for the personal-account rule.

## Data safety

Answer the form so it matches the iOS privacy labels and the privacy policy. Nothing here is tracking. There are no ads and no payments.

Collected, linked to the rider, only if they sign in:

| Data | Purpose |
|---|---|
| Email address | Account management |
| User IDs | Account management |
| Fitness (finished workout summaries, FTP, and the optional age, sex, weight, and resting heart rate) | App functionality |

Collected, not linked to the rider:

| Data | Purpose |
|---|---|
| App interactions (product events sent with no account: the app opened, a workout started, a workout finished) | Analytics |
| In-app feedback notes sent with no account | App functionality |

Events and notes sent while signed in are stored with that account and are deleted with it. The "not linked" rows are the anonymous events and notes, which is how the iOS labels describe product interaction and feedback.

Also answer:

- Data is encrypted in transit (HTTPS to Supabase).
- Users can request deletion in the app: Settings → Your data → Delete account and cloud data.
- Data is not sold.
- Data is not shared for advertising. Supabase hosts the database and sign-in. Google is involved only when the rider chooses Continue with Google. A feedback note can be emailed to the developer through Resend when that is turned on. Those are processors, not ad networks.
- Location is not collected. The fine and coarse location permissions exist only so Android 11 and older will allow a Bluetooth scan, they are capped at API 30, and the app does not read a position. Android 12+ uses `neverForLocation`.
- No photos, contacts, microphone recordings, health-store (Health Connect) reads, or financial info.
- Approximate or precise location: No.
- Device or other IDs: the install id on anonymous product events is an app-generated id, not the advertising id. Declare it only if the form asks about other identifiers used for analytics, and mark it not used for tracking.

## Supabase and Google Cloud, by hand

The iOS app already uses redirect `thirtyfifteen://auth-callback`. Confirm it is still listed. Android uses the same URI.

In the **30/15** Supabase project (not BioAge):

1. Authentication → URL configuration → Redirect URLs includes `thirtyfifteen://auth-callback`.
2. Authentication → Providers → Google stays enabled. The client id and secret are the **Web** application client. Google's authorized redirect URI on that client is the Supabase callback, `https://YOUR_30_15_PROJECT.supabase.co/auth/v1/callback`, not the app scheme. Google sends the rider to Supabase. Supabase sends the rider back to `thirtyfifteen://auth-callback`.
3. The `delete-account` function is deployed, as in [APP-STORE-SUBMISSION.md](APP-STORE-SUBMISSION.md). Android calls the same function.

You do **not** need an Android OAuth client or a SHA-1 for this browser flow. Add one only if a device shows a Google error that the Web client is not allowed from the Android package (for example `Error 400: invalid_request` naming the package or a missing client). If that happens:

1. Print the signing certificate SHA-1. For the EAS credentials that sign the AAB:

```bash
npx eas-cli credentials --platform android
```

Choose the production (or preview) build credentials and read the SHA-1. Do not paste the keystore password into git.

2. In Google Cloud, on the same project as the Web client Supabase uses, create an OAuth client of type Android. Package name `com.kaushikpavani.thirtyfifteen`. SHA-1 from the step above. Preview and production use different keystores if EAS created both, so a preview APK and a Play AAB can need two Android clients.
3. Leave the Supabase Google provider on the Web client id and secret. The Android client only satisfies Google's package check. It does not replace the Web client in Supabase.
4. Rebuild is not required after adding the SHA-1 client, unless you also change the redirect URI.

Sign in with Apple stays an iOS capability. Do not add an Apple service id for Android.

## What a phone has to prove

CI cannot hear audio, see a notification, or talk to a power meter. Before the closed test, run the Android list in [QUALITY.md](QUALITY.md) on a physical phone: YouTube in front, screen off for more than three minutes, a power meter, a heart-rate strap, Google sign-in, and account deletion.
