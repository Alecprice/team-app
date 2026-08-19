# Team APP V1.10 Release Readiness

Status: **NO-GO for real-family production use until the staging gates below are completed.**

This is intentional. V1.10 closes multiple defects found by adversarial testing, but software cannot be proven defect-free. Release readiness is based on explicit evidence and gates rather than a claim of zero bugs.

## Proven in automated/local tests

- Six sports: Baseball, Softball, Soccer, Basketball, Football, Volleyball.
- 183 age/division competition profiles.
- 73 unit-position definitions and 22 layouts/formations.
- Saved-state migration and malformed-state repair.
- Multi-team, football multi-unit, formation, scoring, Game Day, coach workflow isolation.
- Responsive behavior at 320x568, 390x844, 844x390, and 1440x900.
- 200% text-size horizontal-overflow check on core 320px mobile views.
- Accessible names/labels/alt text on core mobile views and common modals.
- Hostile HTML/img/svg event-handler input renders as text and does not execute.
- 80-player / 24-period / 30-event / 40-activity stress test.
- Extreme 500-player / 40-period / 250-event / 200-activity stress test.
- DST/nonexistent local-time handling.
- NWS outage and meaningful forecast-change behavior.
- Offline queue persistence, overwrite behavior, growth bounds and auth-expiry preservation.
- E2EE conversation key rotation and mixed historical key versions on the same retained device profile.
- Form ownership, guardian-child linkage, required checkbox/signature validation and answer bounds.
- Team-scoped conversations and document visibility.
- PWA missing-asset behavior and cache-version contracts.
- Cloudflare Pages CSP, anti-framing and basic security headers.
- Legacy Express status propagation, document visibility and S3 metadata verification contracts.

## Proven on isolated Neon QA branch

The V1.10 Data API migration was compiled on an isolated branch cloned from the current Team APP database. Production was not modified.

Verified:
- exact `app_api(text,jsonb)` dispatcher compiled;
- atomic optimistic revision update is present;
- atomic join-code max-use claim is present;
- helper functions compile against the existing schema;
- malformed/active document type rejection works;
- 501-player context is rejected;
- state above 4 MB is rejected;
- E2EE sender public-key snapshot column exists;
- unique form-assignment target guard exists;
- exactly one authenticated client RPC is executable: `app_api`;
- zero legacy/helper `app_*` RPCs remain client-executable;
- zero direct authenticated/anonymous public-table CRUD grants;
- rate guard accepted 120 calls and rejected call 121.

Upgrade file: `sql/upgrade-v1.9-to-v1.10.sql`.

## Release blockers / mandatory staging gates

### 1. Cloudflare Pages + real HTTPS PWA
Must be tested on the actual Cloudflare Pages production candidate:
- install as PWA;
- close/reopen;
- offline reload;
- offline coach edit;
- reconnect/queue replay;
- V1.9 -> V1.10 service-worker/cache upgrade;
- actual CSP/header behavior.

### 2. Real Neon Auth + Data API HTTP
The SQL compiles on QA, but a browser must exercise real JWTs through the public Data API:
- coach signup/login/session expiry;
- guardian signup/invite/join;
- two-account role boundaries;
- dispatcher errors/rate limits over HTTP;
- near-limit document request behavior.

### 3. Two-device concurrency
The lost-update race is fixed atomically in SQL. It still needs an actual two-device/two-session collision test against staging.

### 4. Dependency lockfile
Direct build dependencies are pinned exactly:
- `@neondatabase/neon-js` 0.6.2-beta
- `esbuild` 0.28.1

The sandbox cannot reach npm long enough to generate `package-lock.json`; `npm install --package-lock-only` timed out. Before production, generate and commit a lockfile on a networked runner, use `npm ci`, and run an advisory audit. A production build without a committed lockfile is not approved.

### 5. E2EE lost-device recovery decision
Key rotation/history works while old device keys remain available. There is not yet account-backed recovery of old conversation keys after browser/device storage loss. Decide whether encrypted message history must survive a lost/replaced phone.

### 6. Coach-private note encryption decision
The static Neon path isolates coach-private notes through the RPC permission layer and Neon storage protections, but those notes are not end-to-end encrypted from database operators. Decide whether strict role isolation is sufficient or client-side encryption is required.

### 7. Closed-app push
Notification preferences and service-worker handling exist, but closed-app Web Push requires a deployed push worker/VAPID path. It is not production-complete.

### 8. File storage scale
Current credential-free Data API document staging is capped at 5 MB/file and 50 MB/team. The S3-compatible object-storage path is code-hardened but has not been live stress-tested. Large photo/video sharing should not launch on DB blobs.

### 9. Automatic invitation email
Current credential-free flow can produce an invitation/join link/code for a coach to share. Automatic email delivery is not configured.

### 10. Sport/rule content validation
The engine is six-sport capable, but non-baseball instructional content is intentionally not treated as fully vetted. League/local rules must remain source-linked and coach-reviewed.

## External platform maturity note

As of this audit, Neon's Data API is documented as beta and the published `@neondatabase/neon-js` package is `0.6.2-beta`. This is acceptable for controlled staging, but it increases the importance of exact dependency pins, a lockfile, staging monitoring and rollback readiness.

## Launch rule

Do not invite real families until every mandatory staging gate is marked PASS and the two encryption-policy questions are answered.
