# Team APP V1.9 — Deployment Status

Current status: **Not deployed to Vercel.**

The previous Vercel URL has been intentionally removed so Team APP can be redeployed with a clean project scope.

## Backend retained

- Neon project: `team-app`
- Neon Postgres schema/data: retained
- Neon Data API/RPC layer: retained
- Neon Auth: retained
- Neon Auth trusted production origins: **none currently configured**
- Localhost auth remains allowed for development

## Next deployment scope

Recommended clean deployment ownership:

- GitHub repository: dedicated Team APP repository only
- Vercel project: `team-app`
- Vercel production alias: generated from the Team APP project, then optionally a custom domain
- Neon Auth trusted origins: add only the verified final production origin and explicitly approved preview/local origins
- No reuse of unrelated Vercel projects or GitHub repositories

## Deployment gate

Before binding Neon Auth to Vercel:

1. Deploy the clean release.
2. Verify the Vercel project/deployment is actually present and READY.
3. Verify index, manifest, service worker and cloud client from the production origin.
4. Add that exact origin to Neon Auth trusted origins.
5. Run synthetic coach/guardian E2E tests.
6. Remove synthetic test records.
