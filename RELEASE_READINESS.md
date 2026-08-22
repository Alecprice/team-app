# Team APP V1.10 Release Readiness

Status: **NO-GO for real-family production use until the remaining staging gates below are completed.**

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

## Proven on Neon

The V1.10 Data API migration was first compiled and exercised on an isolated release-candidate branch cloned from Team APP main.

The live Neon `main` branch was subsequently inspected and verified to match the V1.10 release-candidate schema with an empty schema diff.

Verified on the current main schema:
- exact `app_api(text,jsonb)` dispatcher exists;
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
- Neon Auth and Data API support roles/schemas are present;
- rate guard accepted 120 calls and rejected call 121 during QA validation.

Upgrade file: `sql/upgrade-v1.9-to-v1.10.sql`.

## Dependency/build reproducibility — PASS

The repository now contains a committed npm lockfile and exact direct build dependency pins:

- `@neondatabase/neon-js` 0.7.0-beta
- `esbuild` 0.28.1
- `wrangler` 4.123.0
- Playwright 1.62.0 for browser regression tests

A clean `npm ci` install completed with zero reported npm audit vulnerabilities. Transitive Better Auth/Neon Auth peer-resolution warnings remain visible and should continue to be regression-tested rather than hidden.

GitHub CI now installs from the lockfile, installs the pinned Python Playwright dependency and Chromium, runs the full regression suite, and runs `npm run verify:release`.

## Release blockers / mandatory staging gates

### 1. Cloudflare Pages + real HTTPS PWA
Must be tested on the actual Cloudflare Pages production candidate:
- public production smoke workflow passes;
- install as PWA;
- close/reopen;
- offline reload;
- offline coach edit;
- reconnect/queue replay;
- V1.9 -> V1.10 service-worker/cache upgrade;
- actual CSP/header behavior.

A manual GitHub **Production Smoke** workflow now checks the public root, production cloud bundle, service worker, manifest, baseline headers, and PWA static contract. That workflow is a prerequisite, not a replacement for the device tests above.

### 2. Real Neon Auth + Data API HTTP
Database-side configuration is present, but a real browser must exercise actual sessions/JWTs through the public Data API:
- coach signup/login/session expiry;
- guardian signup/invite/join;
- two-account role boundaries;
- dispatcher errors/rate limits over HTTP;
- near-limit document request behavior.

### 3. Two-device concurrency
The lost-update race is fixed atomically in SQL. It still needs an actual two-device/two-session collision test against staging.

### 4. E2EE lost-device recovery decision
Key rotation/history works while old device keys remain available. There is not yet account-backed recovery of old conversation keys after browser/device storage loss. Decide whether encrypted message history must survive a lost/replaced phone.

### 5. Coach-private note encryption decision
The static Neon path isolates coach-private notes through the RPC permission layer and Neon storage protections, but those notes are not end-to-end encrypted from database operators. Decide whether strict role isolation is sufficient or client-side encryption is required.

### 6. Closed-app push
Notification preferences and service-worker handling exist, but closed-app Web Push requires a deployed push worker/VAPID path. It is not production-complete.

### 7. File storage scale
Current credential-free Data API document staging is capped at 5 MB/file and 50 MB/team. The S3-compatible object-storage path is code-hardened but has not been live stress-tested. Large photo/video sharing should not launch on DB blobs.

### 8. Automatic invitation email
Current credential-free flow can produce an invitation/join link/code for a coach to share. Automatic email delivery is not configured.

### 9. Sport/rule content validation
The engine is six-sport capable, but non-baseball instructional content is intentionally not treated as fully vetted. League/local rules must remain source-linked and coach-reviewed.

## Platform maturity note

The current client intentionally pins the beta `@neondatabase/neon-js` integration used by this release. Beta infrastructure increases the importance of exact dependency pins, a committed lockfile, automated regression coverage, staging monitoring, and rollback readiness.

## Launch rule

Do not invite real families until every mandatory staging gate is marked PASS and the two encryption-policy questions are answered.
