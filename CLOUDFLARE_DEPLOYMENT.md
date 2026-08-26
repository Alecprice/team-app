# Team APP Cloudflare deployment

## Pages frontend

- Project: `team-app`
- GitHub repository: `Alecprice/team-app`
- Production branch: `main`
- Build command: `npm run build`
- Build output: `dist`
- Wrangler config: `wrangler.jsonc`
- Runtime: static PWA; Neon Auth + Neon Data API are called directly from the browser.

The `_headers` file is copied into `dist/` during build and is the source of truth for Pages static response security headers.

The production build must contain the generated `cloud-client.js` bundle plus the offline queue and connectivity modules used by that bundle. Run:

```bash
npm run verify:release
```

before promoting a release. The verifier checks build output, PWA/runtime wiring, lockfile alignment, manifest/service-worker contracts, and baseline security headers.

## Public deployment verification

After Pages reports a successful production deployment, run the repository's manual GitHub workflow:

**Actions -> Production Smoke -> Run workflow**

Default expected origin:

```text
https://team-app.pages.dev
```

Equivalent local command:

```bash
npm run smoke:prod -- https://team-app.pages.dev
```

Do not mark the deployment verified merely because the build completed. The public smoke must prove that the expected assets and response headers are actually being served.

## Worker jobs

- Worker: `team-app-jobs`
- Config: `worker/wrangler.jsonc`
- Purpose: scheduled weather/notification/email work only.
- Current state: scaffold only. The scheduled handler intentionally performs no external delivery actions until production secrets/providers are configured and tested.
- Health route: `GET /health`
- Health response explicitly reports `mode: "scaffold"` and `deliveryEnabled: false`.

Compile/check the Worker without deploying it:

```bash
npm run verify:worker
```

This uses Wrangler's dry-run bundling path; CI runs it after the main Pages regression/release checks.

## Secrets and environment

The primary static Pages application does not need the retained Node/Express `.env.example` secrets simply to build and serve `dist/`. Neon Auth/Data API endpoints used by the browser are configured in the client source for this release.

Worker/provider secrets should be added only when the corresponding background delivery feature is enabled and reviewed. Do not copy unused legacy service secrets into Pages.

## Neon origin binding

Do not add a production trusted origin to Neon Auth until the final Cloudflare Pages production deployment is verified. Then add only the canonical production HTTPS origin.

After adding the trusted origin, complete the synthetic coach/guardian authenticated staging flow and two-session/offline-reconnect tests in `RELEASE_READINESS.md` before inviting real families.
