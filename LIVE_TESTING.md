# Team APP V1.10 Live Testing

Use synthetic adult accounts only. Do **not** use real family, child, coach, guardian, or team data for release-gate testing.

## What the automated live smoke proves

`scripts/live-account-smoke.mjs` exercises the deployed Cloudflare Pages + Neon path rather than a local mock.

Read-only mode verifies:

- anonymous Data API access is rejected;
- email/password sign-in works through the same-origin `/api/auth` Pages Function;
- the first-party auth proxy remains `no-store` and exposes its Team APP marker;
- the signed-in session produces the Neon JWT required by the Data API;
- that JWT can execute the single audited `app_api(text,jsonb)` dispatcher and read the synthetic account context;
- the synthetic account is signed out after the check.

Mutation mode additionally creates a clearly named throwaway `TENX Smoke ...` baseball team and sends two concurrent coach state updates with the same expected revision. Exactly one update must succeed and exactly one must return `revision_conflict` with status 409 in the dispatcher response.

Guardian mode is optional and requires mutation mode. It uses a second synthetic adult account to verify the actual invitation and authorization path:

- coach creates a guardian invitation for the second synthetic account;
- guardian signs in through the same first-party auth proxy;
- guardian accepts the invitation through `app_api`;
- guardian can read the authorized team member projection;
- guardian is reported with the `guardian` role in account discovery;
- guardian cannot execute the coach-only team-state write.

Mutation mode intentionally prints `TENX_SMOKE_TEAM_ID=<uuid>` and `CLEANUP_REQUIRED`. V1.10 does not expose a client team-delete RPC, so the throwaway team must be removed using an approved admin/database cleanup path after verification.

## Required GitHub secrets

Create dedicated synthetic adult accounts. Store their credentials as repository secrets:

```text
TEAM_APP_SMOKE_EMAIL
TEAM_APP_SMOKE_PASSWORD
TEAM_APP_SMOKE_GUARDIAN_EMAIL
TEAM_APP_SMOKE_GUARDIAN_PASSWORD
```

The guardian secrets are required only when **guardian** mode is enabled. The coach and guardian smoke accounts must be different accounts. Do not reuse a personal, production coach, guardian, or family account.

## GitHub workflow

Run **Live Account Smoke** manually from GitHub Actions.

- Leave **mutate** off for the normal auth/JWT check.
- Enable **mutate** only when intentionally running the throwaway-team concurrency test.
- Enable **guardian** together with **mutate** to exercise invitation acceptance and role boundaries with the second synthetic adult account.
- The workflow has no `push`, `pull_request`, or scheduled trigger and therefore cannot send smoke credentials automatically.

## Local invocation

Read-only:

```bash
export TEAM_APP_SMOKE_EMAIL='synthetic-coach@example.invalid'
export TEAM_APP_SMOKE_PASSWORD='set-locally-do-not-commit'
npm run smoke:account
```

Concurrency mutation:

```bash
export TEAM_APP_SMOKE_MUTATE=1
npm run smoke:account
```

Guardian role boundary:

```bash
export TEAM_APP_SMOKE_MUTATE=1
export TEAM_APP_SMOKE_GUARDIAN=1
export TEAM_APP_SMOKE_GUARDIAN_EMAIL='synthetic-guardian@example.invalid'
export TEAM_APP_SMOKE_GUARDIAN_PASSWORD='set-locally-do-not-commit'
npm run smoke:account
```

Never commit credentials, shell history containing real credentials, or generated authentication state.

## What remains manual

This smoke does not replace:

- installed-PWA offline edit/reconnect tests on real iOS/Android devices;
- complete session-expiry testing;
- E2EE lost-device policy validation;
- closed-app push delivery;
- large-file/S3 validation;
- final league/rule-content review.
