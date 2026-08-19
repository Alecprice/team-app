# Team APP V1.9 Deployment

## Production components

- Mobile-first PWA / static assets served by the Node service
- Express API
- PostgreSQL / Neon
- Self-hosted Better Auth adapter for adult accounts and passkeys
- S3-compatible private object storage for team documents
- Web Push using VAPID
- NWS forecast/alert monitoring cron
- App-layer encryption key for coach-private state and drawn signatures
- Client-side E2EE for private message bodies

## 1. Install and build

```bash
npm install
npm run build
```

`cloud-client.js` is generated during the build. Do not rely on the fallback file checked into the source package for a production deployment.

## 2. Database

For a completely fresh database:

```bash
npm run db:bootstrap
```

For an existing Team APP database that already has the V1.7/core tables:

```bash
npm run db:service
npm run db:seed
```

`db:seed` idempotently loads the six sport adapter metadata and all 183 competition profiles.

The V1.9 service uses an optimistic-revision team snapshot during the migration from the prototype. More relational sport/event tables remain in `schema.sql` for the next normalization stage.

## 3. Authentication

The production source defaults to self-hosted Better Auth because Team APP currently enables the passkey plugin. Run:

```bash
npm run auth:migrate
```

The auth database connection is automatically scoped to the separate `auth` schema. Child athletes do not register; adult coaches, staff, and guardians authenticate.

A managed Neon Auth instance may also be provisioned on the same Neon project, but it is not used by this build's passkey adapter. Keep one identity provider authoritative per deployment.

## 4. Required environment

Copy `.env.example` to your hosting provider's secret/environment settings. In production you need at minimum:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (32+ chars)
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `TEAM_APP_DATA_KEY`
- non-local `STORAGE_PROVIDER` and object-storage settings
- `CRON_SECRET`

For email invitations/magic links, configure `RESEND_API_KEY` and `EMAIL_FROM`.

For Web Push:

```bash
npm run push:keys
```

Store the generated public/private keys in `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

## 5. Private object storage

Production refuses `STORAGE_PROVIDER=local`. Configure an S3-compatible private bucket. Team APP uses signed PUT/GET URLs and server-side encryption. If `S3_KMS_KEY_ID` is supplied it requests SSE-KMS; otherwise it requests AES-256 server-side encryption.

Do not make the document bucket public.

## 6. Weather monitor

Call this endpoint on a schedule using your host's cron/scheduler:

```text
POST /api/cron/weather
Authorization: Bearer <CRON_SECRET>
```

Hourly is appropriate for the current monitoring design. It checks upcoming outdoor events and queues notifications only for meaningful forecast/alert changes.

## 7. Health check

```text
GET /api/health
```

Expected response includes `ok: true`, service name, and version `1.9.0`.

## 8. Docker

A production multi-stage `Dockerfile` is included. The runtime runs as an unprivileged user and expects all secrets from environment variables.

## Important launch boundary

Before inviting real families, complete an end-to-end staging test of account creation, email delivery, object storage, push notifications, guardian-child linking, form signatures, and E2EE message key exchange on at least one iPhone and one Android device.
