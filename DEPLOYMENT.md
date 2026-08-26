# Team APP V1.10 Deployment

## Production architecture

The primary V1.10 deployment path is:

- **Cloudflare Pages** for the static/mobile-first PWA
- **Neon Auth** for adult coach/staff/guardian sessions
- **Neon Data API** for browser-to-Postgres application RPC access
- **Cloudflare Worker `team-app-jobs`** for scheduled/background notification work once its production providers/secrets are enabled
- **National Weather Service** public APIs for forecast data
- **client-side E2EE** for private message bodies

The older Node/Express service remains in the repository as a compatibility/hardening reference. It is not the primary Cloudflare Pages runtime described below.

## 1. Reproducible install

Use the committed lockfile:

```bash
npm ci
```

Do not replace the release install with a floating dependency install.

## 2. Regression + release gate

Install the pinned browser-test tooling when needed:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
```

Then run:

```bash
npm test
npm run verify:release
```

The release verifier builds `dist/` and checks lockfile alignment, service-worker versioning/precache assets, PWA manifest icons, Wrangler Pages settings, production cloud bundle generation, and baseline `_headers` security contracts.

## 3. Cloudflare Pages

Project configuration:

- project name: `team-app`
- production branch: `main`
- build command: `npm run build`
- build output directory: `dist`
- source config: `wrangler.jsonc`

The build produces a bundled `dist/cloud-client.js` from `client/cloud-entry.js`. The tiny checked-in root `cloud-client.js` is only a development fallback and must never be treated as the production cloud bundle.

`dist/` also contains the main PWA shell, service worker, manifest, core runtime modules, icons, and `_headers`.

## 4. Required static response headers

Cloudflare Pages should honor the repository `_headers` file copied into `dist/` during build. The current release requires at least:

- Content Security Policy
- HSTS
- `X-Content-Type-Options: nosniff`
- anti-framing protection
- referrer policy
- permissions policy

`/sw.js` and `/index.html` are configured for prompt revalidation so an old application shell is less likely to remain pinned after a release.

## 5. Neon

Neon project: `team-app`.

The V1.10 live main schema has been verified to match the release-candidate schema. Client authorization follows the consolidated Data API model:

- authenticated clients execute `app_api(text,jsonb)`
- internal/legacy `app_*` helper functions are not client-executable
- authenticated/anonymous roles have no direct CRUD grants on public application tables

The browser client is configured with the Neon Auth and Data API endpoints in `client/cloud-entry.js`.

## 6. Neon Auth trusted origin

Do not guess or pre-authorize unrelated origins.

After the final Cloudflare Pages production URL is successfully deployed and verified, add only that canonical HTTPS origin to the Neon Auth trusted-origin configuration.

Then test real signup/sign-in/session-expiry and cross-role flows from that exact origin.

## 7. Public production smoke

The repository includes a phone-friendly GitHub Action:

**Actions -> Production Smoke -> Run workflow**

Default target:

```text
https://team-app.pages.dev
```

Equivalent local command:

```bash
npm run smoke:prod -- https://team-app.pages.dev
```

The smoke gate verifies the public app shell, production cloud bundle, offline queue module, connectivity-status assets, service worker, manifest, service-worker precache wiring, and baseline response security headers.

## 8. PWA/device staging

After the public smoke passes, test on real devices/browsers:

- install to home screen
- close/reopen
- offline reload
- make an offline coach edit
- reconnect and confirm queued sync replay
- update from V1.9 cache/service worker to V1.10
- confirm the top-bar connectivity/sync indicator correctly reflects online/offline/pending state
- verify no horizontal overflow at narrow mobile widths

## 9. Authenticated staging flow

Use synthetic adult test accounts and non-real child/player data.

Exercise:

1. coach account creation/sign-in
2. create/publish team
3. guardian invitation or join code
4. guardian joins linked athlete
5. second-account role-boundary checks
6. event availability response
7. document upload/open/acknowledgment
8. form assignment/submission/signature
9. secure conversation creation/message exchange
10. session expiry/re-authentication
11. two-device optimistic-revision collision
12. offline edit/reconnect queue replay

Delete synthetic accounts/data after validation.

## 10. Scheduled Worker

`worker/wrangler.jsonc` defines `team-app-jobs` with an hourly schedule. The Worker is intentionally a scaffold until notification/email/provider secrets are configured and tested.

Do not describe closed-app Web Push or automatic invitation email as production-complete until the Worker path is enabled and verified.

## 11. File-storage boundary

The current credential-free Data API document path is intentionally bounded and appropriate for controlled staging/smaller team documents. Large photo/video sharing should not launch on database blobs.

The repository retains the hardened S3-compatible storage service path for a later live object-storage rollout and stress test.

## 12. Legacy Node/Express compatibility path

`server/`, `Dockerfile`, and related service tests remain useful for hardened compatibility/reference behavior. They are not required to serve the primary Cloudflare Pages static PWA.

Do not mix the legacy self-hosted Better Auth service and Neon Managed Auth as simultaneous authoritative identity providers for the same deployment.

## Launch boundary

A successful build or public Pages smoke is not enough to invite real families.

`RELEASE_READINESS.md` is the launch authority. Real-family production use remains blocked until the required live-device/auth/concurrency gates are PASS and the E2EE lost-device plus coach-private-note encryption policy decisions are resolved.
