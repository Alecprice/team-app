# Team APP clean deployment reset

Status: **PUBLIC CLOUDFLARE DEPLOYMENT NOT YET VERIFIED**

The previous/stale Vercel origin was removed from Neon Auth. The intended production path is Cloudflare Pages + Neon Auth/Data API, with the scheduled `team-app-jobs` Worker enabled separately when its providers/secrets are production-ready.

## Intended production scope

- GitHub owner: `Alecprice`
- GitHub repository: `team-app`
- Default branch: `main`
- Cloudflare Pages project: `team-app`
- Build command: `npm run build`
- Build output directory: `dist`
- Wrangler Pages config: `wrangler.jsonc`
- Neon project: `team-app`
- Neon Auth production trusted origin: add only the final verified canonical Pages origin

## Safe order

1. Use the dedicated `Alecprice/team-app` repository and verified V1.10 branch.
2. Run the regression and release gates: `npm test` and `npm run verify:release`.
3. Connect `Alecprice/team-app` to a Cloudflare Pages project named `team-app`.
4. Configure the Pages build command as `npm run build` and output directory as `dist`.
5. Wait for a successful production deployment.
6. Run the GitHub **Production Smoke** workflow against the exact production URL. The default expected origin is `https://team-app.pages.dev`.
7. Confirm `/`, `/cloud-client.js`, `/core/cloud-queue.js`, `/core/connectivity-status.js`, `/core/connectivity-status.css`, `/sw.js`, and `/manifest.webmanifest` all pass.
8. Confirm production CSP/HSTS/anti-framing and related `_headers` behavior through the smoke workflow and a real browser.
9. Add only the final canonical Cloudflare Pages production origin to Neon Auth trusted origins.
10. Run the coach -> guardian -> athlete -> availability -> document acknowledgment -> form submission flow with synthetic adult test accounts.
11. Run two-session concurrency plus PWA install/offline/reconnect/service-worker-upgrade tests.
12. Delete synthetic test data/accounts after validation.

## Important

Do not reuse `eifs-quotes`, `template-test.github.io`, `template-BoilerPlate`, or any unrelated project/repository for Team APP.

Do not treat a successful static Pages deploy as permission to invite real families. `RELEASE_READINESS.md` remains the launch authority until the remaining device/account gates are marked PASS.
