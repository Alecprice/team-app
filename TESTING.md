# Team APP V1.10 Testing

## Local release gate

From the repository root:

```bash
npm ci
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm test
npm run verify:release
```

`npm test` runs the static/schema contracts plus the Playwright browser regression suite. `npm run verify:release` creates the Cloudflare Pages build and then checks that the package lock, V1.10 service-worker cache namespace, PWA precache assets, manifest icons, Wrangler Pages settings, bundled cloud client, and baseline security headers remain aligned.

## Automated GitHub CI

`.github/workflows/ci.yml` reproduces the release gate on Ubuntu using:

- Node from `.node-version`
- `npm ci`
- Python 3.12
- the pinned Playwright version from `requirements-dev.txt`
- Chromium installed by Playwright
- the full V1.10 regression suite
- the Cloudflare release verifier

CI has read-only repository permissions and cancels superseded runs on the same ref.

## Current regression coverage

The V1.10 suite covers:

- six sport adapters
- 183 competition profiles
- registry/schema synchronization
- saved-state V2 -> V8 migration
- malformed/corrupted state recovery
- multi-team isolation
- Coach Center workflow
- football multi-unit isolation
- sport scoring models
- formation/layout behavior
- team default layouts
- 66 layout combinations at 320x568
- responsive behavior at 320x568, 390x844, 844x390, and 1440x900
- 200% mobile text-size overflow checks
- accessibility labels/names on core mobile views
- hostile input/XSS rendering safety
- 80-player heavy mobile stress
- 500-player extreme season stress
- cloud/service hardening contracts

Stress ceilings are regression loads, not service-level performance guarantees.

## Production smoke from GitHub

A phone-friendly manual workflow is available at **Actions -> Production Smoke -> Run workflow**.

The default target is:

```text
https://team-app-6mh.pages.dev
```

The workflow checks:

- `/`
- `/cloud-client.js`
- `/sw.js`
- `/manifest.webmanifest`
- baseline production security headers
- the PWA manifest contract
- that `cloud-client.js` is a real production bundle rather than the tiny development fallback
- service-worker cache policy suitable for prompt updates

The same check can be run locally:

```bash
npm run smoke:prod -- https://team-app-6mh.pages.dev
```

## Staging gates that still require real accounts/devices

Public-asset smoke testing is not a substitute for authenticated staging. Before inviting real families, exercise the following against the actual Cloudflare Pages origin and live Neon Auth/Data API:

- create adult coach account and sign in/out
- session expiry and re-authentication
- guardian signup/invite/join
- two-account role boundaries
- publish/synchronize team state
- two-device optimistic-revision collision
- offline coach edit -> reconnect -> queue replay
- PWA install, close/reopen, and offline reload
- V1.9 -> V1.10 service-worker/cache upgrade
- guardian availability response
- document upload/download/acknowledgment
- form assignment/submission/signature
- direct E2EE conversation between separate adult devices
- CSP/header behavior in the real browser

Closed-app Web Push, automatic invitation email, and large-object storage remain separate production-completion items and should not be treated as complete merely because the static PWA passes smoke testing.
