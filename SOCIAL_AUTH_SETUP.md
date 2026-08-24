# Team APP Social Login Setup

Updated: 2026-08-24

## What the app supports in code

The Team APP sign-in UI now supports build-time provider flags for:

- Google
- Apple
- Facebook
- Microsoft

Email/password remains available as a fallback.

Only providers listed in `TEAM_APP_SOCIAL_PROVIDERS` render to users. This prevents an unconfigured provider from presenting a broken login button.

Example:

```
TEAM_APP_SOCIAL_PROVIDERS=google,microsoft
```

Do **not** put OAuth client secrets in Team APP's browser build, Cloudflare Pages public variables, source files, GitHub Actions logs, or `wrangler.jsonc`.

## Current auth architecture

Team APP currently uses Neon Managed Auth, which is Better Auth compatible.

### Release candidate Auth URL

```
https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth
```

Provider callback base:

```
https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/<provider>
```

Examples:

```
https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/google
https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/microsoft
```

### Production Auth URL

```
https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth
```

Provider callback base:

```
https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/<provider>
```

Do not configure production provider credentials until the RC provider flow has passed the two-account/two-device tests.

## Important Neon Managed Auth limitation

Current Neon Managed Auth provider management documents Google, GitHub, and Microsoft. The Team APP client is already prepared for Apple and Facebook, but **do not enable `apple` or `facebook` in `TEAM_APP_SOCIAL_PROVIDERS` while using the current managed-provider configuration** unless Neon confirms those providers are available in the project's Auth console.

For Apple/Facebook, the future options are:

1. Neon adds those providers to Managed Auth; enable them there and then turn on the Team APP feature flag.
2. Run a self-managed Better Auth service on Cloudflare Workers backed by Neon, with Apple/Facebook configured server-side. This is a deliberate auth architecture migration and must be tested on RC before replacing Managed Auth.

## Google — recommended first provider

Provider console:

https://console.cloud.google.com/apis/credentials

Steps:

1. Open Google Cloud Console.
2. Create or select a Team APP Google Cloud project.
3. Open **Google Auth Platform / OAuth consent screen** and configure the app name, support email, audience, and contact details.
4. Open **APIs & Services → Credentials**.
5. Create **OAuth client ID** → **Web application**.
6. Add the Neon Auth callback URL as an Authorized redirect URI:
   - RC: `https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/google`
   - Production later: `https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/google`
7. Copy the Google Client ID and Client Secret.
8. Open Neon Console:
   https://console.neon.tech/
9. Open **team-app → release-candidate branch → Auth → Configuration/OAuth Providers**.
10. Enable **Google**.
11. Prefer Neon shared credentials for the first RC smoke test if offered. For branded production consent, use the custom Google client ID/secret.
12. Confirm the RC Team APP HTTPS origin is in Neon Auth **Trusted Origins**.
13. Set the RC Cloudflare Pages build variable:
    `TEAM_APP_SOCIAL_PROVIDERS=google`
14. Deploy the RC/preview build.
15. Test:
    - new Google signup
    - returning Google sign-in
    - Google sign-in while opening an email-bound Team APP invite
    - wrong Google email against an invitation
    - sign-out/sign-in on a second device
    - existing email/password user using the same Google email

## Microsoft — optional managed provider

Provider console:

https://entra.microsoft.com/

Steps:

1. Sign in to Microsoft Entra.
2. Open **Identity → Applications → App registrations**.
3. Create **New registration**.
4. For a consumer-friendly Team APP, choose the account audience deliberately; do not default to a single business tenant unless desired.
5. Add a Web redirect URI:
   - RC: `https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/microsoft`
   - Production later: `https://ep-noisy-violet-awtos8ns.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/microsoft`
6. Copy the Application (client) ID.
7. Create a client secret under **Certificates & secrets**.
8. Configure Microsoft under Neon Auth's OAuth Providers.
9. Only after Neon reports the provider active, change the build flag to:
   `TEAM_APP_SOCIAL_PROVIDERS=google,microsoft`
10. Verify account identity/authorization using the Team APP server-side membership gates; do not use a Microsoft email string as the authorization key.

## Apple — code-ready, backend provider still required

Apple Developer portal:

https://developer.apple.com/account/resources/identifiers/list

Apple Sign in documentation:

https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web

Do not enable the Team APP Apple button yet on the current Managed Auth deployment.

When the backend provider is available:

1. Apple Developer membership is required.
2. Create/enable a primary **App ID** with Sign in with Apple.
3. Create a **Services ID** for the Team APP website.
4. Associate the Services ID with the primary App ID.
5. Register the Team APP HTTPS domain.
6. Register the exact Better Auth return URL for Apple.
7. Create a Sign in with Apple private key.
8. Record:
   - Services ID / client ID
   - Team ID
   - Key ID
   - private key
9. Store the private key only in the server-side auth service.
10. Generate/rotate the Apple client-secret JWT server-side.
11. Add `https://appleid.apple.com` as a trusted auth origin if required by the Better Auth deployment.
12. Enable `apple` in `TEAM_APP_SOCIAL_PROVIDERS` only after the backend reports Apple configured.
13. Test Apple's Hide My Email flow and repeat sign-in: Apple often returns the email only on the first authorization.

Apple does not allow localhost/non-HTTPS return URLs, so use the real RC HTTPS deployment for testing.

## Facebook — code-ready, backend provider still required

Meta Developer portal:

https://developers.facebook.com/apps/

Better Auth provider guide:

https://better-auth.com/docs/authentication/facebook

Do not enable the Team APP Facebook button yet on the current Managed Auth deployment.

When the backend provider is available:

1. Create a Meta developer app.
2. Add Facebook Login.
3. Obtain the App ID and App Secret.
4. Configure the exact Better Auth OAuth callback URL as a valid OAuth redirect URI.
5. Keep the App Secret only in the server-side auth service.
6. Request only the minimum scopes needed for identity: normally `email` and `public_profile`.
7. Configure app domains/privacy/contact information required by Meta.
8. Move the Meta app through the required development/live review state.
9. Enable `facebook` in `TEAM_APP_SOCIAL_PROVIDERS` only after provider configuration is live.
10. Test Facebook accounts that do not return an email; Team APP must not silently grant an invitation based on an absent/untrusted email.

## Cloudflare Pages settings

Cloudflare dashboard:

https://dash.cloudflare.com/

For the RC/preview build, use branch-specific variables:

```
TEAM_APP_ENV=release-candidate
TEAM_APP_NEON_AUTH_URL=https://ep-billowing-unit-awtg96dy.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth
TEAM_APP_SOCIAL_PROVIDERS=google
```

Keep the RC Data API URL already assigned to the release candidate.

For production, do not change the provider flag until the production provider is separately configured and tested.

## Security rules for all social providers

- OAuth authenticates identity; Team APP membership still authorizes access.
- A successful OAuth login must never bypass invitation/team/guardian rules.
- Keep provider client secrets/private keys server-side.
- Require verified email where the provider gives a trustworthy verification signal.
- Do not trust a raw email claim from a provider that does not strongly verify it.
- Do not allow cross-account provider linking without explicit testing.
- Never unlink a user's last working authentication method.
- Preserve the pending Team APP invite URL across the OAuth redirect.
- Clear sensitive invite query parameters after successful acceptance.
- Test account removal, invite revoke, wrong-email invite, and device switching with every enabled provider.

## Desktop test checklist after provider setup

1. Build with `TEAM_APP_SOCIAL_PROVIDERS=google`.
2. Confirm only Google + email/password are shown.
3. Create a new Google account.
4. Sign out and sign back in.
5. Open a Team APP invite link while signed out and complete Google OAuth.
6. Confirm the invite is accepted only when the Google-authenticated account matches the invited email.
7. Repeat with a different Google account and verify denial.
8. Verify the new account cannot read another team by changing IDs/URLs manually.
9. Verify explicit sign-out hides cached real-team UI.
10. Verify installed PWA OAuth returns to the correct app/invite.
11. Repeat on iPhone and desktop.
12. Only then configure the production Google provider.
