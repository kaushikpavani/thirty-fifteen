# Sign in with Apple

30/15 offers **Continue with Apple** on iOS next to **Continue with Google**. Sign-in is optional. Home → Start does not ask for an account, a sensor, or a network.

Use the **dedicated 30/15 Supabase project** only. Do not use the BioAge project. Do not point this app at any other app's database.

The iOS build uses the native Apple sheet (`expo-apple-authentication`) and sends the identity token to Supabase with `signInWithIdToken`. The token's audience is the bundle id `com.kaushikpavani.thirtyfifteen`. Apple sends the person's name only the first time they approve the app. The app saves that name onto the Supabase user.

Team ID: `9R7M4ATZJ8`  
Expo account: `pavanikaushik`  
Bundle id: `com.kaushikpavani.thirtyfifteen`  
Services ID to create: `com.kaushikpavani.thirtyfifteen.signin`

`app.json` already sets `ios.usesAppleSignIn` and the `expo-apple-authentication` plugin. EAS adds the Sign in with Apple entitlement when it creates the provisioning profile. You still register the App ID capability and the Supabase provider below. Those are not in git.

## 1. App ID

1. Open [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Sign in with the Apple ID on team **9R7M4ATZJ8**.
3. If `com.kaushikpavani.thirtyfifteen` is not listed, the first EAS build can create it. You can also add it now: **+** → **App IDs** → **App** → description `30/15` → bundle id `com.kaushikpavani.thirtyfifteen` → enable **Sign in with Apple** → leave the server-to-server endpoint blank (Supabase does not use it) → Register.
4. If the App ID already exists, open it, enable **Sign in with Apple**, leave the server-to-server endpoint blank, and save.

## 2. Services ID

Native sign-in checks the bundle id. The Supabase Apple provider form still asks for a Services ID and a key. Create them on the same team.

1. Identifiers → **+** → **Services IDs** → Continue.
2. Description: `30/15 Sign in`. Identifier: `com.kaushikpavani.thirtyfifteen.signin`. Register.
3. Open that Services ID. Enable **Sign in with Apple** → Configure.
4. Primary App ID: `com.kaushikpavani.thirtyfifteen`.
5. Domains: the host of the 30/15 Supabase project, for example `abcdefgh.supabase.co` (no `https://`).
6. Return URL: `https://abcdefgh.supabase.co/auth/v1/callback` (same project, this exact path).
7. Save, then Continue, then Save.

Use the 30/15 project host. Never a BioAge host.

## 3. Sign in with Apple key

1. [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+**.
2. Name: `30/15 Sign in with Apple`. Enable **Sign in with Apple** → Configure → choose the `com.kaushikpavani.thirtyfifteen` App ID → Save → Continue → Register.
3. Note the **Key ID**.
4. Download the `.p8` file once. Apple will not offer it again. Keep it off git and off the app. If it leaks, revoke the key and create another.

## 4. Supabase Apple provider

On the **30/15** project (Authentication → Providers → Apple):

1. Enable Apple.
2. **Client IDs** (comma-separated). Put the Services ID first, then the bundle id:

   ```text
   com.kaushikpavani.thirtyfifteen.signin,com.kaushikpavani.thirtyfifteen
   ```

   Supabase uses the first id for a web OAuth redirect. Native `signInWithIdToken` accepts any id in the list. The TestFlight token's audience is `com.kaushikpavani.thirtyfifteen`, so that bundle id must be in the list. If you also try the flow inside Expo Go, add `host.exp.Exponent` as well. The store build does not need it.

3. Generate the client secret in the Supabase Apple form (not in Safari; use Chrome or Firefox). Paste the Team ID `9R7M4ATZJ8`, the Key ID, the Services ID `com.kaushikpavani.thirtyfifteen.signin`, and the contents of the `.p8`. The secret is stored by Supabase. Do not commit it.
4. Save.

Apple client secrets for the OAuth form expire about every six months. Native TestFlight sign-in keeps working as long as the bundle id stays in Client IDs. When the secret expires, generate a new one the same way if Google-style browser sign-in for Apple is ever turned on. This app's iOS button does not use that browser flow.

Optional, not required for TestFlight: [Sign in with Apple for Email Communication](https://developer.apple.com/account/resources/services/list) if you later send mail to riders who hid their address. The app does not send that mail today.

## 5. Google stays on

Authentication → Providers → Google stays enabled, with redirect `thirtyfifteen://auth-callback`. Apple does not replace it.

## What the rider sees

- iOS Settings → Account, and Progress when signed out: **Continue with Apple**, then **Continue with Google**.
- Dismissing the Apple sheet does nothing else. A real failure is shown.
- Start is unchanged. It does not read the account.
