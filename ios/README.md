# Linguanest — iOS app

A native SwiftUI client for the same backend the web app uses (`server.js` at the
repo root). It talks to the existing Express API over HTTP(S) exactly like the
browser does — no backend changes needed, and no data model duplicated here.

The `.xcodeproj` is **not** checked into git. It's generated from `project.yml` by
[XcodeGen](https://github.com/yonaskolb/XcodeGen), so there's nothing to
hand-edit or merge-conflict in Xcode's project file format.

## One-time setup (needs a Mac)

1. Install Xcode from the App Store (free). Open it once so it finishes
   installing components.
2. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```
3. Generate the project:
   ```bash
   cd ios
   xcodegen generate
   ```
4. Open `GermanVocabHelper.xcodeproj` in Xcode.
5. Select the `GermanVocabHelper` target → *Signing & Capabilities* → set your
   Team (a free personal Apple ID works for Simulator/device testing; TestFlight
   and App Store distribution need the paid $99/yr Apple Developer Program).
6. Pick a Simulator (e.g. iPhone 15) and hit Run (⌘R).

Re-run `xcodegen generate` any time `project.yml` changes (new files under
`GermanVocabHelper/` are picked up automatically — you don't need to regenerate
just for a new `.swift` file, only for target/setting changes).

## Pointing the app at a backend

The app defaults to the production backend (`ServerConfig.productionURL`, the
Render deployment) — Release/TestFlight builds always use it. **Debug builds**
(⌘R from Xcode) show an extra "Server" field on the Login and Settings screens to
override it:

- **Simulator + your Mac's local dev server**: `http://localhost:3000` — the
  Simulator shares your Mac's network stack, so running `npm start` on the Mac
  and using that URL just works.
- **A physical iPhone on the same Wi-Fi** as your dev machine: use your Mac's LAN
  IP instead of localhost, e.g. `http://192.168.1.23:3000`.

iOS requires HTTPS for anything that isn't localhost or a private LAN address
(`NSAllowsLocalNetworking` in `project.yml` covers the local case), and the App
Store requires it outright; the production URL is HTTPS.

Login uses the same cookie-based session as the web app. `URLSession` stores and
resends that cookie automatically (it survives app relaunches, same 30-day
expiry as the browser session), so there's no separate mobile auth to build or
maintain.

## What's implemented

- **Login / Sign up** — email/password against `/api/login` and `/api/register`, plus native **Sign in with Apple**, session cookie persisted by `URLSession`
- **Today** — translate (`/api/translate`), save, speak (`AVSpeechSynthesizer`), dictate (`Speech` framework)
- **Lists** — grouped by day, bulk add, edit/delete, CSV export via the share sheet, delete a whole day
- **Games** — all 5 modes, difficulty levels, scoring, missed-words summary, same answer-normalization rules as the web app (case/space/hyphen-insensitive)
- **Stats** — worst-first table, reset
- **Settings** — language pickers, words-per-game, server URL, logout

**Not ported:** the Admin screen (user management). It's a niche feature for a
personal project — add it later the same way as the other screens if you end up
needing it on mobile.

## Sign in with Apple — setup required

The code and entitlement are in place, but the capability itself has to be
enabled on Apple's side, which needs a **paid** Apple Developer Program
membership (the free tier can't provision it):

1. Enroll in the Apple Developer Program ($99/yr) if you haven't yet — see
   *Path to TestFlight* below, since you need this either way.
2. In Xcode, with your paid-account Team selected and "Automatically manage
   signing" checked, the **Sign In with Apple** capability (declared in
   `project.yml`'s `entitlements` block) gets auto-registered against the
   App ID the first time you build — no manual portal visit needed.
3. Backend side: set `APPLE_BUNDLE_ID` in `.env` to match
   `PRODUCT_BUNDLE_IDENTIFIER` in `project.yml` (already done —
   `com.danipina.germanvocabhelper` in both). The server verifies Apple's
   identity token against this as the expected audience; a mismatch here is
   the most common cause of an "Invalid Apple credential" error.
4. Until the capability is provisioned (i.e. before you have a paid account),
   the Sign In with Apple button will fail — email/password login and sign-up
   work regardless, so you're not blocked on this for everything else.

## Building and releasing from GitHub (no Mac needed)

Two workflows in `.github/workflows/` use GitHub's Mac machines (free for public repos):

- **iOS build check** runs automatically when anything under `ios/` is pushed. It
  compiles the Debug (simulator) and Release (device) builds and shows compiler errors
  in the run's *Annotations*. No setup needed.
- **iOS release (TestFlight)** is a button: *Actions → iOS release (TestFlight) → Run
  workflow*. It archives, signs and uploads straight to App Store Connect.

One-time setup for the release button (about 10 minutes):

1. Open [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access →
   Integrations → App Store Connect API → Team Keys**, click **+**, name it "GitHub CI",
   choose access **Admin**, and generate it.
2. Download the `.p8` file (Apple lets you do this only once) and note the **Key ID**
   (next to the key) and the **Issuer ID** (at the top of the page).
3. On GitHub: repository **Settings → Secrets and variables → Actions → New repository
   secret**, and add three secrets:
   - `ASC_KEY_ID`: the Key ID
   - `ASC_ISSUER_ID`: the Issuer ID
   - `ASC_KEY_P8`: the entire contents of the `.p8` file (open it in a text editor,
     including the `-----BEGIN PRIVATE KEY-----` lines)
4. Run the workflow. Leave the build number empty to use 100 + the run number, which
   is always higher than anything uploaded before.

The workflow uses automatic signing with that API key, so Apple creates and renews the
certificates and profiles itself. Bump `MARKETING_VERSION` in `project.yml` whenever you
ship a new App Store version (the build number is handled automatically).

## Path to TestFlight

1. Deploy the backend somewhere with HTTPS, if it isn't already.
2. Enroll in the Apple Developer Program ($99/yr), if you haven't.
3. In Xcode: confirm a unique bundle identifier (currently
   `com.danipina.germanvocabhelper` in `project.yml` — change the prefix if you
   want a different one; if you do, update `APPLE_BUNDLE_ID` in `.env` to
   match), and add a 1024×1024 app icon to
   `GermanVocabHelper/Resources/Assets.xcassets/AppIcon.appiconset` (there's a
   placeholder slot but no image yet).
4. Product → Archive, then use the Organizer window to upload to App Store
   Connect. TestFlight builds are available within minutes of upload; App Store
   review is a separate, later step you only need once you want a public listing.
5. Consider setting up **Xcode Cloud** once you have a paid Developer account
   (free tier: 25 compute-hours/month) so future TestFlight builds can be
   triggered by a git push instead of needing an interactive rented-Mac session
   every time.
