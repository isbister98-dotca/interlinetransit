

## Plan: Set Up Capacitor for Native App

### What we'll do
Install and configure Capacitor so your existing React app can be wrapped as a native iOS/Android app, publishable to the App Store and Google Play.

### Changes

**1. Install Capacitor dependencies** (package.json)
- Add `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` as dependencies
- Add `@capacitor/cli` as a dev dependency

**2. Create `capacitor.config.ts`** in project root
- `appId`: `app.lovable.2d6927d0ca954975820a29167f558d06`
- `appName`: `interlinetransit`
- `webDir`: `dist`
- `server.url`: `https://2d6927d0-ca95-4975-820a-29167f558d06.lovableproject.com?forceHideBadge=true` (enables live hot-reload from the sandbox during development)
- `server.cleartext`: `true`

### After implementation — steps you'll need to do locally

1. **Export to GitHub** via the "Export to GitHub" button in project settings
2. **Clone and install**: `git clone <repo>` then `npm install`
3. **Add platforms**: `npx cap add ios` and/or `npx cap add android`
4. **Update platforms**: `npx cap update ios` / `npx cap update android`
5. **Build**: `npm run build`
6. **Sync**: `npx cap sync`
7. **Run**: `npx cap run ios` (requires Mac + Xcode) or `npx cap run android` (requires Android Studio)

After any future code changes, pull from GitHub and run `npx cap sync` to update the native project.

For more details, check the Lovable blog post on Capacitor mobile development.

