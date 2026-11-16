# App Store submission

First TestFlight build for **30/15**, bundle id `com.kaushikpavani.thirtyfifteen`, team **9R7M4ATZJ8**, Expo account **pavanikaushik**.

Do these on a Mac, from a checkout of this repo, in order, one command at a time. Do not skip the Apple and Supabase steps. The build cannot invent them.

Use the dedicated **30/15** Supabase project only. Do not use the BioAge project. Do not put secret values in git. The service role key never goes in the app or in EAS env.

The app is free. There is no paywall. Start works with no account, no sensor, and no network.

## Versions

`eas.json` sets `cli.appVersionSource` to `remote`, and the production profile sets `autoIncrement` to true.

That means EAS stores the iOS build number (`CFBundleVersion`). `ios.buildNumber` in `app.json` is ignored, so it is not set. The user-facing version stays `expo.version` in `app.json` (`1.0.0`). Bump that when you ship a new version riders see. The build number climbs on its own for each production and preview build, which is what TestFlight requires.

To inspect or seed the remote build number later:

```bash
npx eas-cli build:version:set
```

You do not need that for the first build. EAS starts at 1.

## Home screen name

`expo.name` is `ThirtyFifteen`. Prebuild uses that string for the Xcode project and target. The iPhone home screen name is `ios.infoPlist.CFBundleDisplayName`, which is `30/15`. The Android launcher label is `30/15`, set by `plugins/withAndroidLabel`. The bundle id stays `com.kaushikpavani.thirtyfifteen`.

Do not set `expo.name` back to `30/15`. Prebuild would name the target `3015`. That value is written unquoted in `project.pbxproj`, the Xcode parser reads it as a number, and the production build fails in Configure Xcode project with `Could not find target '3015'`.

## Install on EAS

This repo uses npm and `package-lock.json`. Do not add a `packageManager` field. EAS would follow that field and ignore the lockfile.

`package.json` has `eas-build-pre-install` set to `corepack disable || true`. Each build profile also sets `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` and `COREPACK_INTEGRITY_KEYS=0`. Together those stop Corepack from failing the install step on a package-manager signature check. Leave them in place.

## 1. Apple and Supabase sign-in

Follow [APPLE-SIGN-IN.md](APPLE-SIGN-IN.md) from top to bottom before the build. That covers the App ID capability, the Services ID `com.kaushikpavani.thirtyfifteen.signin`, the Sign in with Apple key, and the Apple provider on the 30/15 Supabase project (Services ID first in Client IDs, then the bundle id).

Google stays enabled, with redirect `thirtyfifteen://auth-callback`.

## 2. Account deletion on the 30/15 project

The in-app delete calls the `delete-account` Edge Function. It will not succeed until this SQL and the function are deployed. Details are also in [supabase/functions/delete-account/README.md](../supabase/functions/delete-account/README.md).

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_30_15_PROJECT_REF
```

`YOUR_30_15_PROJECT_REF` is the subdomain of the 30/15 project URL. Not a BioAge ref.

```bash
npx supabase db query --remote --yes -f supabase/migrations/20261116120000_delete_account_edge.sql
```

If the earlier migrations are not on that project yet, run these in the SQL editor first, in order: `20260926120000_foundation.sql`, `20260926143000_offline_outbox.sql`, `20260926160000_deletion.sql`, `20260928120000_ride_summary.sql`. Then run the command above again.

```bash
npx supabase functions deploy delete-account
```

Do not add `--no-verify-jwt`.

## 3. Log in to Expo

```bash
npx eas-cli login
```

Use the Expo account **pavanikaushik**.

## 4. Link this repo to the Expo project

`app.json` already has `extra.eas.projectId` set to `5fe5855e-1f9e-417f-b31d-abf10c597958` (owner `pavanikaushik`, slug `thirty-fifteen`). Leave it. Skip `eas init`.

## 5. Put the Supabase URL and key on EAS

`.env.local` is gitignored and does not reach EAS. The production profile reads the `production` environment. Current EAS CLI creates a variable with `env:set` (there is no `env:create` subcommand).

Replace the two placeholder values with the 30/15 project URL and its publishable key (the dashboard may still label it anon). Do not use the service role key. Do not commit the commands after you paste the real values.

```bash
npx eas-cli env:set production --name EXPO_PUBLIC_SUPABASE_URL --value 'https://YOUR_30_15_PROJECT.supabase.co' --type string --visibility plaintext --non-interactive
```

```bash
npx eas-cli env:set production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value 'YOUR_PUBLISHABLE_KEY' --type string --visibility plaintext --non-interactive
```

```bash
npx eas-cli env:list --environment production
```

Both names should be listed. The same two commands with `preview` or `development` in place of `production` are only needed if you build those profiles.

## 6. App Store Connect app

`eas.json` `submit.production.ios` already points at the 30/15 app:

- `ascAppId`: `6835283825` (App Store Connect → the 30/15 app → App Information → Apple ID)
- `appleTeamId`: `9R7M4ATZJ8`

Leave both. A submit uploads to that existing app.

App Store Connect URLs, from `site/` once GitHub Pages is publishing:

| Field | URL |
|---|---|
| Support URL | `https://kaushikpavani.github.io/thirty-fifteen/support/` |
| Marketing URL | `https://kaushikpavani.github.io/thirty-fifteen/` |
| Privacy Policy URL | `https://kaushikpavani.github.io/thirty-fifteen/privacy/` |

`.github/workflows/pages.yml` publishes `site/` and asks `actions/configure-pages` to enable Pages (`enablement: true`). The default Actions token cannot create the Pages site. If that step fails, set Settings → Pages → Build and deployment → Source to GitHub Actions, then re-run the workflow.

## 7. Build and submit

```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

When the CLI asks:

- Sign in with your Apple ID and complete 2FA.
- Choose team **9R7M4ATZJ8**.
- Let EAS create the distribution certificate, the provisioning profile, and the App Store Connect API key if they are missing. The app record already exists (`ascAppId` `6835283825`).
- The profile includes Sign in with Apple because `ios.usesAppleSignIn` is true.

Do not pass `--non-interactive` on this first run. A later build can, once the App Store Connect API key exists. `ascAppId` is already set.

`ios.supportsTablet` is false, so App Store Connect will not ask for iPad screenshots.

`ios.config.usesNonExemptEncryption` is false, so the export-compliance question is answered in the binary (standard HTTPS only). If App Store Connect still asks, say the app does not use non-exempt encryption.

The privacy manifest sets tracking to false and declares UserDefaults reason `CA92.1` (rides and settings on the phone). Expo modules ship their own manifests. If Apple emails about a missing reason after the upload, add that reason under `ios.privacyManifests` and build again.

Bluetooth permission text is one line: `30/15 reads cycling power and heart rate from your sensors.` The sheet is not shown on first launch. It is shown when the rider taps Connect on a meter or heart-rate strap. There is no notification permission prompt.

## 8. Keep the Apple ID in eas.json

`ascAppId` is already `6835283825`. If App Store Connect ever shows a different Apple ID for this app, replace that value and leave `appleTeamId` as `9R7M4ATZJ8`.

## 9. Install it yourself from TestFlight

1. Wait until the build leaves Processing in App Store Connect → the 30/15 app → TestFlight.
2. Open **Internal Testing**. The Account Holder on team 9R7M4ATZJ8 can be an internal tester without Beta App Review.
3. If you are not already in the internal group, add the Apple ID you use on the iPhone.
4. On the iPhone, install Apple's TestFlight app, sign in with that Apple ID, and install 30/15.

Check, on that phone: Start with nothing paired and nobody signed in; Connect asks for Bluetooth only after the tap; Continue with Apple sits with Continue with Google; Settings → Your data → Delete account removes the account you just created.

## 10. App Review notes

When you submit for review, paste this into Notes:

```text
No sensor is required. Start works without a power meter, without a heart-rate strap, and without an account or a network. Live watts appear only when a Bluetooth power meter is paired. Live heart rate appears only when a heart-rate strap is paired. Sign-in is optional: Settings → Account offers Continue with Apple and Continue with Google. Account deletion is in Settings → Your data → Delete account (cloud account) or Delete account and iPhone data (cloud account and this phone). The app is free. There is no subscription and no in-app purchase.
```

App Privacy questions, if Connect asks: the app does not track. Sign-in is optional. If a rider signs in, the account can store their email and name, and finished rides can sync to that account. Bluetooth is used to read a power meter and a heart-rate strap. It is not used for location.

Screenshots are iPhone only. Capture the real UI. Do not show a login wall before Start.
