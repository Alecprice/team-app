# Team APP V1.10.1 — Security, Quality & Product Follow-Up

Updated: 2026-08-24

This document records the second hardening/audit pass on the Cloudflare Pages + Neon release candidate. Production and `main` remain frozen until the live two-account/two-device gates pass.

## Implemented in this pass

### Security and privacy
- [x] Require cryptographic randomness for application-generated IDs; no `Math.random()` fallback.
- [x] Render official/rule links only when they resolve to HTTPS.
- [x] Add same-origin resource policy and disable legacy cross-domain policy files.
- [x] Prevent stale `build-info.json` caching.
- [x] Add poisoned saved-state browser regression for unsafe links, colors, and logo data URLs.
- [x] Require guardian roles to retain an athlete relationship.
- [x] Require bounded invitation/join-code expiration (1–168 hours).
- [x] Bound join-code use count (1–10).
- [x] Increase new guardian join-code entropy from 8 to 12 hex characters.
- [x] Keep the stronger join-code helper internal; authenticated browser clients can execute only `app_api`.
- [x] Continue to reject Medical / Safety documents from the general shared-document path.
- [x] Continue email-bound, hashed invitation tokens and verified-email membership gates.

### Reliability and scale
- [x] Hydrate cloud teams with bounded concurrency (maximum four at a time), prioritizing the active team.
- [x] Preserve message drafts on send failure.
- [x] Reduce message polling and avoid hidden-tab polling.
- [x] Serialize cloud sync attempts in the production bundle.
- [x] Keep build SHA/environment identity in release artifacts and verify exact deployed commit during smoke tests.
- [x] Add real extreme-data performance budgets to CI.

### Mobile and usability
- [x] Add a post-invite result card with **Text invite**, **Share**, and **Copy link**.
- [x] SMS action opens the device messaging composer with a prefilled secure invite message.
- [x] Native Web Share is used when available.
- [x] Cloud documents use native file sharing on capable mobile devices, with a normal download fallback.
- [x] Keep large-list search, minimum touch-target hardening, reduced-motion support, focus trapping, accessible labels, and persistent storage-failure warning.

### Rules / factual correctness
- [x] Preserve current Little League age-based daily pitch and rest tables.
- [x] Add same-day pitching aggregation.
- [x] Block second pitching appearances for Minor/Major/Intermediate profiles.
- [x] Treat age-12 Junior/Senior same-day pitching conservatively.
- [x] Flag the Junior/Senior 30-pitch first-game threshold for official review.
- [x] Keep explicit caveats for threshold-at-batter, pitcher/catcher, suspended-game, and local-league rules.
- [x] Confirm U.S. Soccer grassroots models, USA Football practice guidance, USA Basketball coaching source, and current USA Volleyball rules sources remain appropriate.

## Required desktop/live gates before production

1. Run clean install, full tests, release verification, and Worker dry-run.
2. Run the new poisoned-state test and all browser security suites.
3. Create two verified adult test accounts on the release-candidate Auth/Data endpoints.
4. Verify owner/admin/coach/manager/guardian/readonly boundaries by directly attempting forbidden actions, not only by hiding buttons.
5. Create guardian invite, tap **Text invite**, send/open it on a second phone, sign up/sign in, and verify email-bound acceptance.
6. Verify expired, revoked, reused, wrong-email, unlinked-athlete, malformed, and brute-force-style join/invite attempts fail safely.
7. Test member removal while the removed account is open, backgrounded, offline, and installed as a PWA.
8. Test two devices and two tabs editing the same team, including offline queue replay and conflict resolution.
9. Test E2EE conversation creation, member removal, future-key rotation, lost-device recovery messaging, and inability to overwrite another member's existing envelope.
10. Verify Cloudflare production headers/CSP, build SHA, service-worker update/reload, offline reopen, and no sensitive invite URL retained in Cache Storage.
11. Run production dependency audit from the lockfile and review any GitHub/Dependabot alerts.
12. Verify Neon Auth production settings: verified email required, correct canonical production origin, unnecessary localhost/providers disabled.
13. Protect GitHub `main` and Neon production branch before promotion.
14. Perform a restore drill and document recovery before storing real family data.

## Remaining engineering priorities

### P0/P1 — before broad production
- [ ] Complete primary-state migration from localStorage to transactional IndexedDB.
- [ ] Implement account-scoped state export/import/recovery.
- [ ] Replace full-team snapshot writes with dirty-slice/delta synchronization for high-churn Game Day data.
- [ ] Move document bytes to private object storage and retain only metadata/provenance in Postgres.
- [ ] Finish server validation of nested context objects and lengths.
- [ ] Define explicit manager permissions separate from access to private player-development/evaluation notes.
- [ ] Make membership removal trigger a complete conversation-membership/rekey workflow.
- [ ] Add first-class join-code list/revoke UI.
- [ ] Replace remaining blocking `alert()` cloud errors with inline retryable states.
- [ ] Finish verified-email and trusted-origin production Auth configuration.
- [ ] Add account disable/pseudonymization, retention, export, and deletion policies.

### Performance / architecture
- [ ] Incrementally render Game Day/lineup/check-in instead of rebuilding the entire app DOM.
- [ ] Split the large `app.js` controller into feature modules with explicit contracts.
- [ ] Lazy-load non-active historical teams/seasons.
- [ ] Cursor/infinite-load message history rather than keeping large histories in one DOM.
- [ ] Add long-session soak/memory tests and database query-plan benchmarks.
- [ ] Introduce season archival so old data does not inflate the active working set.

## High-value additional features

1. **Team announcement composer** — one-way coach announcements with scheduled send, acknowledgements, and reminder resend.
2. **Invite Center** — pending/accepted/expired/revoked invites, resend/share/text/QR, join-code history, and one-tap revoke.
3. **Calendar integration** — iCal subscription plus Apple/Google Calendar add buttons and schedule-change notices.
4. **Attendance dashboard** — RSVP trends, late/missing responses, attendance streaks, and coach follow-up queue.
5. **Game Day quick mode** — extremely simplified sideline UI for score, period, substitutions, pitch count, and undo.
6. **Season templates / rollover** — clone staff/settings/rules while starting a clean roster/schedule/history.
7. **Role/permission editor** — explicit capabilities such as scheduling, documents, private notes, messaging, forms, and roster administration.
8. **Emergency contacts card** — optional coach-only quick-access contacts with deliberate privacy controls; do not put medical records in the generic document system.
9. **Practice planner recommendations** — build sessions from age/sport/time/equipment constraints and saved drill library.
10. **Post-game recap** — score/participation/pitch workload/notes with coach-reviewed summary and export.
11. **QR invite sharing** — useful at parent meetings without manually typing an email or code.
12. **Direct SMS/email delivery provider** — later, use a server-side provider so the coach can send without leaving Team APP; keep OS-native Text/Share as the credential-free fallback.
13. **Support diagnostics** — safe build/version/PWA/sync diagnostics attached to bug reports, excluding roster/message content.
14. **Coach audit timeline** — human-readable membership, role, invite, document, and security-sensitive changes.
15. **Closed-beta controls** — invite/allowlist first organizations while the app completes production hardening.

## Release principle

A green unit/browser suite is necessary but not sufficient. Do not promote V1.10.1 until the release candidate also passes the manual adversarial two-account/two-device tests and the production infrastructure gates above.
