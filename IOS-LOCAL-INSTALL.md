# Install 30/15 on an iPhone from a Mac

A Mac Mini, a free Apple ID, and Xcode can put **30/15** on a physical iPhone. The icon on the home screen is this app. It is not Expo Go.

The bundle id in `app.json` is `com.kaushikpavani.thirtyfifteen`. The phone must be on **iOS 16.4 or newer**. Expo SDK 57 needs **Xcode 26.4 or newer** and **Node.js 22.13 or newer**.

This is a development install. It is signed with your **Personal Team**. Apple’s account help says that kind of provisioning profile expires **7 days** after it is issued. You rebuild and reinstall to renew it. It is not an App Store build and it is not TestFlight.

## Why this path

Expo Go cannot open the Bluetooth radio, so **Settings → Power meter** does not work there. Expo Go also does not apply this project’s native background-audio config (`UIBackgroundModes` and `enableBackgroundPlayback` in `app.json`). Those are baked in when the native project is generated. See [Power meter](README.md#power-meter) and [BACKGROUND.md](BACKGROUND.md).

A local compile is how Expo installs on an iPhone without a paid Apple Developer account. From a Mac, with Xcode:

```bash
npx expo run:ios --device
```

[EAS](https://docs.expo.dev/develop/development-builds/introduction/) iOS **device** builds are a different path. Expo’s docs say those need a paid Apple Developer account for signing. `eas.json` in this repo still has `development` and `production` profiles for that path. This file does not replace them.

A free Apple ID in Xcode is a **Personal Team**. [Apple’s developer account help](https://developer.apple.com/help/account/basics/about-your-developer-account/) states the limits:

- Up to **10 App IDs**, which expire after 7 days.
- Up to **3 devices**, which expire after 7 days.
- Up to **3 apps** installed per device.
- Provisioning profiles that let the app install expire **7 days** from issuance. Rebuild and reinstall after that.

App Store Connect and TestFlight are for Apple Developer Program members. A Personal Team cannot submit to the App Store.

## Prerequisites

- A Mac Mini on a macOS version that can install the current Xcode from the Mac App Store.
- **Xcode 26.4 or newer**, from the Mac App Store. Open it once, accept the license, and let it install extra components if it asks.
- **Xcode Command Line Tools.** In Xcode: **Xcode → Settings → Locations**, then choose the latest entry in **Command Line Tools**.
- The **iOS platform**. In Xcode: **Xcode → Settings → Components**, then under **Platform Support** choose **Get** on the iOS row. Expo’s [environment setup](https://docs.expo.dev/get-started/set-up-your-environment/) uses this screen.
- **Node.js 22.13 or newer** and npm. This repo uses npm (`package-lock.json`). Check with `node -v`.
- A free Apple ID. Sign that same Apple ID into Xcode. It should show as a Personal Team.
- A USB cable for the first install. A later install can use the phone if it already appears in the device list without the cable.
- The iPhone unlocked. On the first connection, tap **Trust** and enter the passcode.
- **Developer Mode** (iOS 16 and later). The row appears after the phone has been paired with the Mac. See the steps below.

## One-time Mac setup

1. Clone the repo, or pull if you already have it:

```bash
git clone https://github.com/kaushikpavani/thirty-fifteen.git
cd thirty-fifteen
```

2. Install JavaScript dependencies:

```bash
npm install
```

Use `npx expo`, not `npm expo`. If install reports `Cannot find module 'expo/config-plugins'`, delete `node_modules` and run `npm install` again. Do not run `npm audit fix`.

3. **expo-dev-client is optional, and this repo does not depend on it yet.** `package.json` does not list `expo-dev-client`. You do not need it for Bluetooth or for background audio. Skip the install unless you want the development-client launcher.

   A development client is for day-to-day edits: the native app stays installed, and JavaScript reloads from Metro on the Mac. It still needs Metro. It is not a ride with the laptop closed.

```bash
npx expo install expo-dev-client
```

   The `development` profile in `eas.json` sets `developmentClient: true` for EAS. That cloud iPhone build needs a paid Apple Developer account. This file is the local path, and the commands below work without adding the package.

4. Sign the Apple ID into Xcode so the Personal Team exists:

   **Xcode → Settings → Accounts**, and add the Apple ID.

   After it signs in, the team list should show your name with **(Personal Team)** beside it. If the list is empty, the device install cannot sign.

## Developer Mode on the iPhone

Apple’s [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) page: the switch shows up only after you start pairing the phone with the Mac.

1. Plug the iPhone into the Mac with USB. Unlock it. Tap **Trust** if asked.
2. On the Mac, open **Xcode → Open Developer Tool → Device Hub**. Expo’s device setup uses Device Hub to surface the developer-mode warning.
3. On the iPhone: **Settings → Privacy & Security → Developer Mode**. Turn the switch on.
4. Tap **Restart** on the alert.
5. After the phone boots, unlock it and confirm the alert, then enter the passcode. Apple’s guide names the button **Enable**. Expo’s device setup names it **Turn On**. Use the button on the alert.

Until Developer Mode is on, a development-signed app will not launch.

## Build and install

From the repo root, with the phone plugged in, unlocked, and trusted:

```bash
cd thirty-fifteen
git pull origin main
npm install
npx expo run:ios --device
```

`npx expo run:ios` can run only on a Mac with Xcode. If `ios/` is missing, the command generates it (prebuild), then compiles, installs, and starts Metro. `ios/` and `android/` are generated and gitignored. Do not commit them, and do not edit them by hand.

1. When the CLI lists devices, pick the iPhone. Do not pick a simulator.
2. The first successful run registers the device on your Personal Team and installs **30/15**.
3. If signing fails, or Xcode opens on the project, set the team once:
   - Open the workspace with `xed ios` (the `.xcworkspace` inside `ios/`, not the `.xcodeproj`).
   - Select the app target. Open **Signing & Capabilities**.
   - Turn on **Automatically manage signing**.
   - Set **Team** to your **Personal Team**.
   - Leave the bundle id at `com.kaushikpavani.thirtyfifteen` unless Xcode says that id cannot be registered. If it does, change `ios.bundleIdentifier` in `app.json` to a unique id, then regenerate with `npx expo prebuild -p ios --clean` and run the device command again. Reuse one bundle id. A Personal Team can only register 10 App IDs in 7 days.
4. If the phone says the developer is not trusted, go to **Settings → General → VPN & Device Management**. On older iOS the row may be named **Device Management**. Select the certificate for your Apple ID and tap **Trust**.
5. Open **30/15** from the home screen.

The first compile is the long one. Later runs reuse `ios/` unless you change native dependencies or `app.json`.

### Metro, or JavaScript inside the app

The command above is a **Debug** build. Expo installs a real native app (Bluetooth and this project’s background audio are in it) and then starts **Metro** on the Mac. The phone loads JavaScript from that Mac. Quit Metro, sleep the Mac, or leave the network, and the icon opens a connection error instead of the workout. Start Metro again from the repo:

```bash
npx expo start
```

`--no-bundler` only skips launching Metro. It does not put JavaScript in the app.

For a ride that does not need the Mac after install, compile **Release**. Expo’s CLI embeds the exported JavaScript in the binary for that configuration. Signing is still your Personal Team development profile, so the 7-day limit still applies. This is not an App Store signature.

```bash
npx expo run:ios --device --configuration Release
```

After that install, unplug the phone and open **30/15**. Metro can be stopped. A JavaScript change means running the Release command again.

### Xcode, if you would rather press Run

Use this when the CLI cannot see the phone, or when you want the signing screen in front of you.

1. Generate the native project if `ios/` is not there yet:

```bash
npx expo prebuild
```

   If `npx expo run:ios` already created `ios/`, skip prebuild.

2. Open the workspace:

```bash
xed ios
```

3. Choose your iPhone in the run destination. Plug it in and unlock it if it is missing.
4. **Signing & Capabilities**: **Automatically manage signing**, **Team** = **Personal Team**.
5. Press **Run**.

Xcode’s Run action is **Debug** unless you change it, so JavaScript still comes from Metro. To embed JavaScript, use **Product → Scheme → Edit Scheme**, select **Run**, set **Build Configuration** to **Release**, close the scheme editor, and press **Run** again. Do not use **Product → Archive**. Archive is the App Store path, and a Personal Team cannot submit.

## After install

Confirm the home-screen icon is **30/15**, not Expo Go.

1. Open the app. Home shows **Start**. Press it. No account is required.
2. **Settings → Power meter**. Wake the meter with a pedal stroke on the SRAM crank, scan, and connect. Watts show up only after a real measurement. The steps are in [Power meter](README.md#power-meter).
3. Optional. Start a ride, leave the app, and open YouTube. Cues should keep time. The check is in [BACKGROUND.md](BACKGROUND.md).

A Debug install still needs Metro for step 1. A Release install does not.

## When it expires (about 7 days)

Apple’s account help: rebuild and reinstall after the provisioning profile expires. The usual symptom is that **30/15** will not launch, often with **Unable to Verify App**.

Trusting the developer again does not renew an expired profile. Plug the phone in, unlock it, and run the same command you used to install:

```bash
npx expo run:ios --device
```

Or, if you had been riding without Metro:

```bash
npx expo run:ios --device --configuration Release
```

Pressing **Run** again in Xcode is the same fix. The new profile lasts about another 7 days.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| **Untrusted Developer**, or the icon will not open the first time | **Settings → General → VPN & Device Management** (older iOS: **Device Management**). Under **Developer App**, select the Apple ID and tap **Trust**. Developer Mode must also be on. |
| No **Developer Mode** row | Plug in, unlock, tap **Trust**, and open **Xcode → Open Developer Tool → Device Hub**. Then look again under **Settings → Privacy & Security**. Confirm the alert after the restart. |
| `Signing for … requires a development team` | **Xcode → Settings → Accounts** must show the Apple ID as a **Personal Team**. In the app target, **Signing & Capabilities**, turn on **Automatically manage signing** and choose that team. Then run `npx expo run:ios --device` again. |
| Bundle id is not available, or cannot be registered | Keep `com.kaushikpavani.thirtyfifteen` unless that id is already taken by another team. If you must change it, edit `ios.bundleIdentifier` in `app.json`, run `npx expo prebuild -p ios --clean`, and install again. Do not invent a new id for every attempt. The Personal Team cap is 10 App IDs in 7 days. |
| Phone never appears in the device list | Use a data-capable cable. Unlock the phone. Tap **Trust**. Try another port. Open Device Hub and confirm the phone is paired. Wireless shows up only after that first USB pair, and only when the phone is already listed. |
| Red screen: could not connect to the development server | This is a **Debug** install waiting for Metro, not an expired profile. From the repo, run `npx expo start`, or reinstall with `--configuration Release` so JavaScript is inside the app. |
| **Unable to Verify App** after it had been launching | The 7-day profile lapsed. Trust will not renew it. Reinstall with `npx expo run:ios --device` (add `--configuration Release` if you want JavaScript in the binary). |
| **The maximum number of apps for free development profiles has been reached** | A Personal Team can have 3 apps installed on one device. Delete an older app signed with that Apple ID, then install again. |
| App ID or device limit from Apple | 10 App IDs and 3 devices, each window 7 days, per Apple’s account help. Reuse this bundle id and this phone. Wait for an old registration to expire rather than creating more ids. |
| Build asks for an Apple Distribution certificate | That is App Store signing. A Personal Team does not have it. Stay on **Automatically manage signing** with the **Personal Team**, and install with `npx expo run:ios --device` or the Release device command. Do not Archive. |

## What this does not do

- It does not put 30/15 on the App Store or on TestFlight. Those need a paid Apple Developer Program membership.
- The paid membership (the $99 program) is what you use when the weekly rebuild is in the way. Development installs on that account are not stuck on the Personal Team’s 7-day profile. EAS builds that install on an iPhone also need that paid account. Local `npx expo run:ios --device` on this Mac does not.
- The install path in this file is Xcode and Expo’s local compile. The `development` and `production` profiles in `eas.json` stay as they are for the paid path.

## Sources

Checked against the docs below while writing this.

- [Expo: set up an iOS device with a local development build](https://docs.expo.dev/get-started/set-up-your-environment/) — Xcode from the Mac App Store, Command Line Tools, iOS platform, USB trust, Developer Mode, `npx expo run:ios --device`.
- [Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/) — local compile is the iPhone install without a paid Apple Developer account; EAS iOS device builds need one.
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) — `--device`, `--configuration Release` (JavaScript embedded; not signed for App Store submission), `xed ios`.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) — Node.js 22.13.x, iOS 16.4+, Xcode 26.4+.
- [Apple: developer account overview](https://developer.apple.com/help/account/basics/about-your-developer-account/) — Personal Team, 7-day profiles, App ID and device caps, 3 apps per device, rebuild to renew.
- [Apple: Enabling Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) — **Settings → Privacy & Security → Developer Mode**.
