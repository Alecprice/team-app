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
