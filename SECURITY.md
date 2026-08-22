# Team APP V1.10 Security Architecture

## Launch posture

V1.10 is a hardened staging candidate, not an authorization to invite real families. Security readiness is evidence-based and the remaining live-device/account gates are tracked in `RELEASE_READINESS.md`.

## Core principles

- adult accounts; child athletes are profiles, not login identities
- least-privilege team roles
- authorization enforced in database/API workflows, not only by hiding UI
- HTTPS/TLS for the production origin
- no direct authenticated/anonymous CRUD grants on public application tables
- one consolidated client RPC entry point
- client-side E2EE for private message bodies
- explicit ownership and relationship checks for guardian workflows
- bounded payload/document sizes
- data minimization for youth profiles
- no advertising/tracking requirement in the youth experience

## Primary V1.10 identity and data path

The Cloudflare Pages client uses **Neon Managed Auth** for adult sessions and the **Neon Data API** for application calls.

The browser client maps Team APP actions to one PostgreSQL dispatcher:

```text
app_api(text, jsonb)
```

The live V1.10 Neon `main` schema has been inspected and currently enforces the intended client boundary:

- `authenticated` has EXECUTE on `app_api` among the application `app_*` functions
- internal/legacy `app_*` helpers are not client-executable
- authenticated/anonymous roles have no direct CRUD grants on public application tables

The older Node/Express + self-hosted Better Auth implementation remains in the repository for compatibility/reference testing. It must not be operated as a second authoritative identity provider beside Neon Managed Auth for the same deployment.

## Authorization

Roles include owner, admin, coach, assistant coach, manager, guardian, member, and read-only.

V1.10 database/RPC checks cover team membership and role-sensitive operations including team state, invitations/join codes, documents, forms, availability, conversations, and notification preferences.

Important boundaries include:

- non-coach team-state projection is reduced
- conversation listing is active-team scoped
- guardian athlete actions require the corresponding relationship/permission
- form submissions require ownership and, where applicable, unambiguous assignment selection
- direct document access uses the same visibility rules as document listing

## Cloud synchronization

Team state uses optimistic revisions. V1.10 advances a revision with an atomic conditional database update so two clients cannot both successfully claim the same prior revision.

The browser is offline-first:

- offline cloud changes are queued locally in IndexedDB with a localStorage fallback
- queue entries are bounded by count and item size
- reconnect attempts queue replay
- revision conflicts are surfaced rather than silently overwriting another device

The production HTML shell explicitly loads the queue module before the cloud client, and release tests verify that wiring.

Real two-session collision and offline/reconnect tests against the deployed Pages origin remain mandatory staging gates.

## Messaging and E2EE

Private message bodies are encrypted in the browser before upload.

- ECDH P-256 device identity keys
- HKDF-SHA256 conversation-key wrapping
- AES-GCM message encryption
- per-recipient key envelopes
- versioned conversation keys
- sender public-key snapshots for historical key-version recovery on retained devices

PostgreSQL stores ciphertext and required routing/authorization metadata. Sender, conversation membership, timestamps, and similar metadata remain server-visible.

A replaced/lost device does not yet have an account-backed recovery mechanism for all historical conversation keys. That policy/product decision remains a launch blocker.

## Coach-private information

The current static Neon path relies on RPC authorization and Neon storage protections for coach-private notes. Those notes are **not** end-to-end encrypted from the database/operator layer.

Before broad launch, decide whether strict server-side role isolation is sufficient or whether coach-private notes require client-side encryption similar to private messages.

## Documents

The current browser/Data API document path is deliberately bounded for controlled staging and smaller documents.

Security controls include:

- file-size/team-storage limits
- file name/type validation
- HTML/SVG/active web content rejection
- visibility/ownership checks on list, direct access, acknowledgment, and deletion paths
- incomplete uploads are not exposed as completed documents
- acknowledgments are tracked separately

Large photo/video sharing should not launch on database blobs. The retained S3-compatible service path has additional storage hardening but still needs live object-storage validation before it becomes a production path.

Malware/virus scanning is recommended before accepting uploads from a broad public user base.

## Forms and signatures

V1.10 validates form ownership and assignment boundaries in the data layer.

- assignments target specific adult users and optionally linked athletes
- guardian/athlete relationships are checked before athlete-linked submission
- ambiguous assignment selection is rejected
- required checkbox/signature behavior is validated
- answer/payload size is bounded
- restricted forms require appropriate assignees/visibility

A typed electronic-signature model is supported by the Cloudflare/Neon client. Any legal reliance on signatures still requires jurisdiction/use-case review.

## Invitations and join codes

Invitation/join workflows are team-scoped. Join-code redemption uses an atomic conditional claim so concurrent requests cannot exceed the configured maximum use count.

Invitation email delivery is not yet production-complete; the current credential-free flow can generate a link/code for manual sharing.

## Availability

Guardians can update availability only for appropriately linked athletes; coach roles can manage the team view. Availability changes remain team/event scoped.

## Push and background jobs

The PWA service worker contains notification handling and the app stores category preferences, but **closed-app Web Push is not production-complete** until the secret-backed `team-app-jobs` Worker/provider path is configured and validated.

Notification payloads for private messages must remain generic and must not expose E2EE plaintext.

## Browser security headers

The Cloudflare Pages `_headers` contract includes:

- Content Security Policy
- `frame-ancestors 'none'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- HSTS
- strict-origin referrer policy
- permissions policy

The CSP restricts script/object/base/frame behavior and explicitly allows the current Neon Auth/Data API plus National Weather Service connections required by the client.

`npm run verify:release` checks these baseline contracts before deployment, and the manual **Production Smoke** workflow checks the actual public response headers after deployment.

## Dependency and release security

- direct release dependencies are pinned
- `package-lock.json` is committed
- CI uses `npm ci`
- Python Playwright is pinned for browser regression testing
- CI installs Chromium explicitly before browser tests
- release verification checks PWA/runtime asset wiring
- a clean `npm ci` run reported zero npm audit vulnerabilities during the current V1.10 hardening pass

Transitive peer/deprecation warnings are not hidden; they should remain visible and regression-tested while the Neon/Better Auth beta dependency tree evolves.

## Logging

Do not log:

- document bytes
- auth tokens/secrets
- encryption keys
- message plaintext
- signature payloads
- sensitive coach notes
- complete youth-profile state in diagnostic logs

Production-facing errors should avoid returning internal exception detail.

## Remaining production hardening

Before broad public launch:

- complete real Pages/PWA/auth/Data API/two-device staging gates
- decide E2EE lost-device recovery requirements
- decide coach-private-note client encryption requirements
- validate closed-app push and automatic email delivery before enabling them
- move large documents/media to a validated private object-storage path
- add malware scanning if broad uploads are enabled
- add centralized structured security/event logging
- establish backup/restore drills and operational incident procedures
- add SBOM/dependency scanning beyond the current npm audit/release checks
- perform privacy/legal review for the actual jurisdictions, leagues, and data collected
