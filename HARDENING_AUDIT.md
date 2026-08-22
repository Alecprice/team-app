# Team APP V1.10 Hardening Audit

## Significant defects found and fixed

1. **Atomic cloud sync race** — two devices could pass the same revision check and overwrite one another. Team-state advancement is now one conditional atomic update.
2. **E2EE version drift** — messages after key rotation could be tagged/decrypted with the wrong conversation-key version. Versioned historical keys and sender-key snapshots are now preserved.
3. **Legacy RPC bypass** — an upgraded Neon database could retain old client-executable `app_*` functions that bypass the consolidated dispatcher. V1.10 revokes every `app_*` client grant and re-grants only `app_api` to authenticated users.
4. **Missing deployed dispatcher** — the existing Neon database had old individual RPCs but no `app_api`; the V1.10 client would have failed cloud operations if deployed unchanged. The upgrade installs the dispatcher and the live main branch now exposes it.
5. **Join-code race** — concurrent redemption could exceed max uses. Redemption now uses an atomic conditional claim.
6. **Ambiguous form assignment** — a guardian with multiple assignments for one form could submit against the wrong child/assignment. Submission now requires unambiguous ownership/assignment selection.
7. **Form validation mismatch** — required checkbox/signature behavior differed between service paths. Validation is aligned and bounded.
8. **Cross-team conversation listing** — conversations could appear from other teams the adult belonged to. Listing is now active-team scoped.
9. **Document direct-access inconsistency** — list visibility was stronger than direct download/ack paths. All document operations now share the same visibility rule.
10. **Express status flattening** — intended 4xx/409 errors could become 500s. Intended status is preserved.
11. **PWA asset fallback** — missing JS/CSS could receive app HTML while offline. Navigation fallback and asset failure are now separated; missing assets fail 503.
12. **Missing static CSP/frame protection** — Cloudflare Pages `_headers` now has a scoped CSP, frame denial, HSTS and supporting headers.
13. **Security-definer function grants** — internal helpers were at risk of default PUBLIC execute. Upgrade-safe dynamic RPC lock-down now removes client access to every internal/legacy function.
14. **Invalid production dependency version** — the release dependency is now pinned to `@neondatabase/neon-js` `0.7.0-beta`; esbuild is pinned to `0.28.1`, Wrangler to `4.123.0`, and the lockfile is committed.
15. **200% mobile text overflow** — Learn cards overflowed a 320px viewport. Grid min-width/wrapping is fixed and regression-tested.
16. **Unverified hostile text rendering** — XSS-style player/practice/event payloads now have a dedicated browser regression and remain inert text.
17. **Non-reproducible CI install** — CI previously used `npm install` despite a committed lockfile. CI now uses `npm ci`.
18. **Incomplete browser-test CI environment** — Playwright-based Python tests could be invoked without explicitly installing the pinned Python package and Chromium. CI now provisions both before the regression suite.
19. **Release drift risk** — version, lockfile, PWA cache assets, manifest icons, Cloudflare output settings, bundle presence, and security headers could drift independently. `npm run verify:release` now checks these contracts together.
20. **No lightweight production endpoint gate** — a reusable public production smoke test and phone-friendly manual GitHub workflow now verify the root page, production cloud bundle, service worker, manifest, and baseline response headers.

## Live Neon verification

The V1.10 release-candidate branch and live `main` schema now compare with an empty schema diff. Direct inspection of `main` confirms:

- `app_api(text,jsonb)` exists;
- authenticated users have EXECUTE on `app_api` only among the `app_*` functions;
- authenticated/anonymous roles have no direct public-table grants;
- the live dispatcher contains the major Team APP action paths for team state, invitations, documents, availability, messaging, forms, and notification preferences.

## Stress ceilings exercised

- 500 players
- 40 periods
- 250 events
- 200 practice activities
- 66 formation/rotation variants at 320px
- 6 sports x 4 viewport classes
- 200% mobile text-size pass
- malformed legacy state/fuzz cases
- 120 allowed rate calls + rejected 121st call on Neon QA
- >4 MB team-state rejection
- >500-player team-state rejection

These are regression loads, not service-level performance guarantees.
