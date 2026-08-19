# Team APP Changelog

## V1.9.1 — Reliability & Production Contract Audit

- Replaced hard-coded event/season defaults with local-date/current-year values.
- Migrates V1.8 browser state into a V1.9 storage key without losing data.
- Standardized the Vercel client on the single checked-in `app_api` Neon RPC.
- Closed private-document acknowledgment and nonexistent-event availability gaps.
- Restricted invitation/join role escalation at the database boundary.
- Added required-field/signature validation for Data API form submissions.
- Added size/count validation for encrypted messages, key envelopes and form schemas.
- Corrected root `npm run dev` / `npm start` to preview the static Vercel architecture.
- Restricted restored team branding to bounded raster image data URLs.
- Added Escape-key handling to app/cloud dialogs.
- Removed generated browser-test reports from source-control churn.
- Updated active service/version labels to V1.9.

# Changelog

## V1.8 — Secure Team Service

- added Node/Express production service source
- added PostgreSQL/Neon service persistence
- provisioned Team APP Neon project and service/core tables
- provisioned managed Neon Auth as an optional identity path
- added passkey-capable self-hosted Better Auth adapter source
- adult coach/staff/guardian accounts only; child athletes remain profiles
- team invitations and hashed join codes
- athlete-linked guardian onboarding
- role-aware team state and UI
- local-first cloud synchronization with revisions/conflict handling
- coach-private state split + encryption at rest
- secure object-storage document workflow and acknowledgments
- document MIME/extension policy and forced attachment downloads
- forms, assignments, submissions and signatures
- guardian/form ownership authorization hardening
- E2EE message ciphertext transport, device keys and key envelopes
- direct adult messaging
- per-team push notification preferences
- NWS weather monitor + scheduled alert endpoint
- guardian event availability
- cross-site mutation/origin protection
- production Docker/deployment files
- Little League Baseball League Age field and Game Day pitch/rest guidance
- regression schema contract increased to 61 tables
- full multi-sport stress suite remains green
