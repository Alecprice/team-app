# Team APP — Prioritized To-Do

Last audit: 2026-08-21

This list consolidates the V1.10 scale, reliability, security/privacy, accessibility, and usability findings found during code/architecture review. The goal is to keep Team APP safe and pleasant as it grows from a single-device coaching PWA into a multi-team, multi-user production service.

## P0 — Must fix before real-family production

- [ ] Require verified email before invitation acceptance, join-based access, or creation of a real cloud team.
- [ ] Isolate or remove production `?demo=1`; demo mode must never reuse real-account local state or IndexedDB data.
- [ ] Remove cloud `documents` metadata from generic team-state snapshots. Use the authorized document service as the only cloud source of truth for documents.
- [ ] Remove/disable Medical / Safety document sharing until athlete-specific restricted ACLs exist.
- [ ] Harden E2EE key-envelope authority: prevent ordinary conversation members from replacing another recipient's existing envelope for the same key version; define authorized key rotation and immutable/version-monotonic behavior.
- [ ] Prevent Service Worker cache keys from retaining invitation tokens or other sensitive query parameters. Normalize navigation caching to a token-free app shell.
- [ ] Add team-access removal lifecycle: member removal, role change/downgrade, owner transfer rules, invitation revoke, join-code revoke, and team deletion/archival.
- [ ] Couple membership removal with conversation membership removal and rotation of future E2EE keys.
- [ ] Require explicit handling of linked guardian access when an athlete is removed/deactivated.
- [ ] Disable the production "Reset demo app data" action outside an isolated demo/dev build.
- [ ] Complete real HTTPS/browser release gates before inviting real families: install/reopen, offline reload/edit, reconnect replay, actual CSP/headers, real Auth/Data API sessions, two-account role boundaries, and two-device conflict testing.

## P1 — Scale / architecture

### Local state and rendering

- [ ] Move primary application state from one `localStorage` blob to IndexedDB (or another transactional local store). Keep localStorage only for small preferences/pointers.
- [ ] Make storage failure visible and persistent. Never silently continue in memory after a persistence failure; show that changes are temporary and offer recovery/export guidance.
- [ ] Add self-service state export/backup and restore/import for offline recovery.
- [ ] Stop serializing the entire multi-team application state on every small interaction. Persist dirty team/slice changes only.
- [ ] Add a stable cloud-payload hash/dirty marker so UI-only state (team switch, view switch, etc.) does not advance cloud revisions or create audit writes.
- [ ] Replace whole-app `innerHTML` rerenders with incremental/view-scoped rendering for high-frequency Game Day, lineup, check-in, and score actions.
- [ ] Split the large `app.js` UI/state controller into feature modules (navigation/shell, roster, lineup, Game Day, schedule/weather, practice, coach admin, documents) with explicit state contracts.
- [ ] Add performance budgets to CI: maximum navigation/render latency, save latency, serialized-state size, DOM-node count, and memory growth under stress.
- [ ] Add long-session soak tests, not only one-time large-dataset renders.

### Cloud sync and multi-device behavior

- [ ] Lazy-load team detail after login instead of sequentially fetching every team's full state before the app becomes usable.
- [ ] Add bounded-concurrency/background hydration for non-active teams.
- [ ] Move toward relational/delta sync for high-churn domains rather than replacing the full team snapshot for lineup/score/check-in changes.
- [ ] Avoid re-upserting the entire roster and staff list on every team-state sync when those collections did not change.
- [ ] Add cross-tab coordination using BroadcastChannel/storage events: shared sign-out, active-account changes, local-state refresh, and a single sync leader.
- [ ] Add explicit role-downgrade/revocation behavior for an already-open/offline tab.
- [ ] Preserve offline Game Day, but make offline access account-scoped to the last successfully verified adult/device state rather than a generic coach fallback.

### Messaging

- [ ] Change conversation history to true cursor pagination/infinite loading; do not eagerly place up to ~1,000 messages into the DOM on every open.
- [ ] Reduce/replace fixed 3-second polling with event-driven or adaptive polling when appropriate.
- [ ] Virtualize/prune large message histories in the UI while preserving accessible navigation.
- [ ] Define guardian-to-guardian messaging policy (disabled, opt-in, or permitted) rather than implicitly allowing DMs to every team adult.
- [ ] Hide guardian/athlete relationship details from unrelated non-coach members unless the product explicitly requires that visibility.
- [ ] Decide and implement lost-device E2EE recovery policy before promising recoverable encrypted history.

### Database, storage, quotas, and recovery

- [ ] Add/test indexes for hot access paths, especially membership lookup by user, conversation membership lookup by user, and message pagination by conversation + time/id.
- [ ] Benchmark index changes on a Neon branch with realistic seeded data before applying them to production.
- [ ] Add hard lifetime/resource quotas in addition to per-minute rate limits (teams, forms, invitations/codes, conversations/messages, stored data).
- [ ] Move production document bytes to private object storage before broad launch. The current Postgres document allowance can consume the current branch-size ceiling too quickly.
- [ ] Increase/document production recovery retention and perform a real restore drill. A short PITR window plus an old backup branch is not enough once family data exists.
- [ ] Protect the Neon production branch and require branch-based migration verification.
- [ ] Protect GitHub `main` and require the release-gate CI status before merge/push to production.
- [ ] Define account disable/pseudonymization and data-retention semantics for messages, audit events, signatures, form history, documents, invitations, and snapshots; do not rely on naive hard delete.
- [ ] Preserve original assignment/athlete context in retained form submissions if assignments are later removed.
- [ ] Reuse/uniquely identify seasons by organization + sport + season identity instead of creating duplicate season rows for every team.

### Data contracts and validation

- [ ] Add a server-side `teamRecord` validator with payload cap, nested field limits, color validation, URL-scheme validation, location validation, branding limits, staff limits, and layout/schema checks.
- [ ] Strengthen `context` validation beyond top-level count/size checks: validate nested player/event/practice/session shapes and field lengths.
- [ ] Add a global RPC payload-size limit before action-specific parsing.
- [ ] Add poisoned/malformed cloud-state browser tests so hostile server data cannot break every member's UI.
- [ ] Resolve form schema drift: implement validated `select` fields/options end-to-end or remove `select` from accepted server types for V1.10.
- [ ] Separate operational roles from sensitive-note permissions; do not automatically treat `manager` as entitled to private development/evaluation notes unless explicitly intended.
- [ ] Re-evaluate the generic roster `attendance` field exposed in member snapshots; prefer event-specific linked-athlete availability as the family-facing source of truth.
- [ ] Normally require a guardian invitation/join to link at least one athlete; use a distinct role for unrelated team adults/read-only users.

### PWA / deployment consistency

- [ ] Fingerprint mutable JS/CSS assets by content hash or force revalidation for all mutable shell assets to prevent mixed old/new releases.
- [ ] Add build/version SHA to the UI/support diagnostics and production smoke report.
- [ ] Test service-worker update activation, stale-tab recovery, back/forward navigation, background/foreground transitions, and V1.9 -> V1.10 upgrade behavior.
- [ ] Add a visible "new version available" / safe reload path when an installed PWA has stale code.
- [ ] Update architecture/deployment docs to the current Cloudflare Pages + Neon RPC architecture; remove stale Express/S3-as-current-production wording.

## P1 — Usability / accessibility

### Navigation and information architecture

- [ ] Add search/filter/sort for roster, schedule/events, documents, forms, members, and conversations before large lists become normal.
- [ ] Test task completion on realistic phone sizes, not only overflow: add player, build lineup, start game, substitute, record score/pitches, submit availability, open document, complete form.
- [ ] Revisit six-item bottom navigation at narrow widths; guarantee comfortable touch targets and readable labels on 320px devices.
- [ ] Give primary mobile actions a minimum ~44–48px touch target; many `small-btn` controls are currently visually/tactually small.
- [ ] Keep high-frequency Game Day controls thumb-reachable and prevent accidental adjacent taps under field conditions.
- [ ] Add empty/loading/error/retry states consistently to every cloud panel rather than relying on blocking alerts or console errors.

### Forms and errors

- [ ] Fix form labeling so every input/select/textarea has a real programmatic label (`for`/`id`, wrapping label, or aria-labelledby). The current accessibility test can false-pass labels merely located in the same `.field` container.
- [ ] Upgrade the accessibility test to use the browser accessibility tree / accessible-name computation rather than DOM proximity heuristics.
- [ ] Replace generic toast/`alert()` validation with inline field-level errors for forms where possible.
- [ ] Preserve entered values when sign-in/signup or other network forms fail.
- [ ] Add forgot-password/password-reset flow and clear recovery guidance.
- [ ] Prevent double-submit on network-backed actions with consistent busy/disabled states.
- [ ] Add destructive-action confirmations that identify exactly what will be removed and whether cloud/offline copies remain.

### Dialog, focus, keyboard, and announcements

- [ ] Give all local modals proper dialog semantics, labelled titles, focus trapping, Escape behavior, and focus restoration to the triggering control.
- [ ] Apply the same focus-management rules to cloud overlays.
- [ ] Make transient toast/status messages accessible with an appropriate live region; do not make important failures disappear after ~2 seconds.
- [ ] Add reduced-motion support (`prefers-reduced-motion`) for animations/transitions.
- [ ] Verify keyboard-only operation of lineup controls, drag/drop alternatives, Game Day controls, forms, tabs, and horizontal scrolling areas.
- [ ] Add automated focus-visible/focus-order checks for modal and navigation flows.

### Clarity and recovery

- [ ] Hide the notification badge unless unread notifications actually exist; turn the Notifications surface into a real unread/history center.
- [ ] Restore/add Support & Feedback with safe diagnostics (app version/build, browser/PWA mode, online/offline/sync state) and never include private team data by default.
- [ ] Confirm before saving phone GPS into shared team/event state; explain that the location will be shared and show a preview.
- [ ] Prefer venue/address geocoding or explicit map selection over silently using the coach's current phone location.
- [ ] When an event falls outside the NWS forecast window, show "forecast not available yet" rather than substituting unrelated nearby forecast hours.
- [ ] Add clearer sync-state language: local saved, cloud synced, queued, conflict, authentication expired, and storage failure must be visually distinct.
- [ ] Add a human-readable conflict comparison before "Use cloud copy" / "Keep this device copy" when practical.

## P1 — Sport/rules correctness

- [ ] Make Little League pitching logic division-aware, not only age-aware.
- [ ] Aggregate same-day pitching across events where the rule set requires it and enforce division-specific same-day game restrictions.
- [ ] Model threshold-at-batter exception behavior, pitcher/catcher restrictions, suspended-game cases, and consecutive-day rules accurately before presenting an "eligible" conclusion.
- [ ] Keep official rule source/version visible and treat local league overrides as a separate, explicit layer.
- [ ] Continue sport-by-sport content/rules validation before calling non-baseball coaching content fully reviewed.

## P2 — Test quality and maintainability

- [ ] Add behavioral cloud-client tests with mocked Neon responses for sign-out, account switching, role downgrade, auth loss, conflicts, queue replay, E2EE rotation, failed requests, and recovery. Do not rely primarily on regex/source-string contract tests.
- [ ] Add real performance assertions to the extreme stress test; current checks prove rendering/no-overflow but do not fail on excessive latency.
- [ ] Add multi-tab tests in addition to multi-team/two-device tests.
- [ ] Add browser-history/back-forward tests.
- [ ] Add screen-reader-oriented accessibility regression tests using actual accessible names/roles/states.
- [ ] Add touch-target measurements and 200%/400% zoom/text tests for high-density screens and dialogs.
- [ ] Add offline-storage quota/failure simulation.
- [ ] Add object-storage near-limit tests before enabling larger production documents.
- [ ] Add synthetic-user end-to-end staging run: coach -> guardian -> linked athlete -> availability -> document -> form -> message -> revoke access -> verify denial.
- [ ] Add production observability for sync conflicts, auth failures, rate limits, document failures, worker failures, and client storage failures without logging sensitive roster/message content.

## P2 — Product/governance cleanup

- [ ] Store adult/guardian attestation with timestamp and policy version; the current signup checkbox is client-only.
- [ ] Add Privacy, Terms, retention/deletion/export, and support/contact surfaces before real-family launch.
- [ ] Consider invite-only/closed-beta signup for the first field test instead of unrestricted self-service cloud team creation.
- [ ] Disable unused production auth surfaces/providers/plugins unless deliberately integrated and tested.
- [ ] Keep development/localhost auth origins separate from production trusted origins.
- [ ] Document who can see: roster identity, availability, contact info, guardian links, coach notes/development, forms, documents, and message metadata.

## What is already strong

- [x] Six-sport registry and shared sport runtime are separated from baseball-specific content.
- [x] Team contexts are isolated in local state.
- [x] Atomic optimistic revision conflict protection exists server-side.
- [x] Offline queue collapses changes per team rather than appending an unlimited event log.
- [x] Server-side Data API access is routed through one authenticated `app_api` entry point.
- [x] Direct authenticated/anonymous table CRUD has been removed from the browser path.
- [x] Guardian event availability read/write is limited to linked athletes; coaches can manage the full roster.
- [x] Document API visibility checks are stronger than the generic snapshot and should become the sole document cloud path.
- [x] Large-state, malformed-state, multi-team, layout, scoring, XSS, offline queue, and responsive regression coverage already exists.
- [x] CI on the audit branch uses the lockfile, pinned browser dependencies, regression tests, release verification, and Worker dry-run verification.

## Release rule

Do not invite real families until all P0 items are complete and the mandatory live-device/browser gates in `RELEASE_READINESS.md` are PASS. P1 scale items that affect data safety, auth/access revocation, storage durability, message/key lifecycle, and object storage should also be complete before broad public use.