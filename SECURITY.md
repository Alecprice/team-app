# Team APP V1.8 Security Architecture

## Core principles

- adult accounts; child athletes are profiles
- least-privilege team roles
- authorization in API/database workflows, not only UI hiding
- HTTPS/TLS in production
- private object storage
- encryption at rest
- client-side E2EE for private message bodies
- explicit audit events for high-value changes
- data minimization for youth profiles
- no advertising/tracking requirement in the youth experience

## Authentication

The source service uses a passkey-capable Better Auth adapter in a separate PostgreSQL `auth` schema. Email/password and magic-link flows are also supported. Production secrets must be stored in the hosting platform, never committed.

Child athletes do not sign up.

## Authorization

Roles include owner, admin, coach, assistant coach, manager, guardian, member and read-only. Server middleware verifies team membership for every team-scoped request.

Non-coach clients receive a reduced team-state projection and do not receive private development/lineup-planning state simply because the frontend bundle contains coach code.

## Browser request protection

State-changing custom API requests reject cross-site browser requests using `Sec-Fetch-Site` and trusted Origin checks. Better Auth maintains its own auth request protections.

## Private coaching information

Coach notes and player-development state are split away from the operational team snapshot and encrypted at rest with a dedicated application data key. A production data key must be independent from the authentication secret.

## Messaging

Private messages use client-side E2EE. PostgreSQL stores ciphertext and cryptographic envelopes, not plaintext message bodies. Push notifications use generic text.

Metadata such as sender, conversation, membership and timestamp remains server-visible because it is required for routing/authorization.

## Documents

- private bucket in production
- signed upload/download URLs
- SSE-KMS when configured, otherwise AES-256 server-side storage encryption request
- file-size limit
- file extension + declared MIME allowlist
- HTML/SVG/active-web document types rejected
- downloads forced as attachments / octet-stream
- private visibility means uploader-private
- completion state prevents incomplete uploads from appearing
- acknowledgments are recorded separately

File scanning/antivirus is still recommended before a public launch if uploads will be accepted from a broad user base.

## Forms and signatures

- assignments belong to specific adult users and optionally athletes
- guardians can only submit athlete-linked forms for linked children with `may_complete_forms`
- required and typed field validation occurs server-side
- unknown fields are rejected
- explicit signature consent is stored
- drawn signature data is encrypted at rest

## Invitations and join codes

Plain invitation tokens and join codes are never stored. Only SHA-256 hashes are retained. Invitations expire and are email-bound. Join codes support expiration and max-use limits.

## Availability

A guardian can update availability only for an athlete linked to that guardian with availability permission. Coaches can manage the full active roster. Changes are audited.

## Push

Push subscriptions are user-scoped. Each team has category preferences. E2EE message plaintext is never inserted into push payloads.

## Logging

Do not log document bytes, auth secrets, encryption keys, message plaintext, signature payloads, or sensitive coach notes. Production error responses hide server exception detail.

## Remaining production hardening

Before a broad public launch:

- malware/virus scanning for uploaded files
- distributed/rate-limit store rather than per-instance memory
- centralized structured security/event logs
- backup/restore drills
- dependency/SBOM/vulnerability scanning in CI
- staging auth/email/storage/push end-to-end tests
- legal/privacy review for the actual jurisdictions, leagues and data collected
