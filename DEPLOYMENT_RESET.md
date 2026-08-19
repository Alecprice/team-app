# Team APP clean deployment reset

Status: **NOT DEPLOYED**

The previous/stale Vercel origin has been removed from Neon Auth. Neon Auth currently has no production trusted origin. Team APP is migrating to Cloudflare Pages + Workers.

## Intended production scope

- GitHub owner: `Alecprice`
- GitHub repository: `team-app`
- Default branch: `main`
- Cloudflare Pages project: `team-app`
- Cloudflare account: select the intended account during Pages Git integration
- Neon project: `team-app`
- Neon Auth production trusted origin: **leave empty until Cloudflare Pages deployment is verified**

## Safe order

1. Create the dedicated `Alecprice/team-app` repository.
2. Push this exact `main` branch.
3. Connect that repository to a Cloudflare Pages project named `team-app`.
4. Use the repository's `vercel.json` build settings.
5. Wait for a `READY` production deployment.
6. Verify `/`, `/cloud-client.js`, `/sw.js`, and `/manifest.webmanifest`.
7. Add only the final canonical Cloudflare Pages production origin to Neon Auth trusted origins.
8. Run the coach -> guardian -> athlete -> availability -> document acknowledgment -> form submission smoke flow with synthetic adult test accounts.
9. Delete all synthetic test data/accounts.

## Important

Do not reuse `eifs-quotes`, `template-test.github.io`, `template-BoilerPlate`, or any other unrelated project/repository for Team APP.
