# Team APP Cloudflare deployment

## Pages frontend

- Project: `team-app`
- GitHub repository: `Alecprice/team-app`
- Production branch: `main`
- Build command: `npm run build`
- Build output: `dist`
- Runtime: static PWA; Neon Auth + Neon Data API are called directly from the browser.

The `_headers` file is copied into `dist/` during build and is the source of truth for Pages static response security headers.

## Worker jobs

- Worker: `team-app-jobs`
- Config: `worker/wrangler.jsonc`
- Purpose: scheduled weather/notification/email work only.
- Current state: scaffold only. The scheduled handler intentionally performs no external actions until production secrets/providers are configured and tested.

## Neon origin binding

Do not add a production trusted origin to Neon Auth until the final `*.pages.dev` production deployment is verified. Then add only the canonical production origin.
