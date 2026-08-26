# Team APP — Multi-Sport Coach V1.10

> Release status: **staging candidate, not approved for real-family production use yet.** See `RELEASE_READINESS.md` for the remaining live-device gates.

Team APP is a mobile-first team-management and coaching PWA designed for coaches, staff, guardians, and youth-sports operations. Baseball remains the deepest coaching template, while the shared architecture supports Baseball, Softball, Soccer, Basketball, Football, and Volleyball.

V1.10 focuses on release hardening: safer multi-device sync, stricter Neon RPC permissions, improved guardian/form/document isolation, stronger PWA behavior, browser regression coverage, reproducible dependency installs, and Cloudflare Pages release verification.

## Product capabilities

A coach can maintain multiple isolated teams and configure each team independently:

- sport, season, age group, division, and competition profile
- official rule source plus structured local-rule overrides
- team branding, home location, weather coordinates, and staff
- roster and player development
- formations, lineups, rotations, and multi-unit football assignments
- practice plans and learning resources
- schedule, weather, availability, and Game Day
- documents and acknowledgments
- forms, assignments, signatures, and submission tracking
- team/coach/event/direct adult messaging
- per-team notification preferences

The competition registry contains **183 age/division profiles across six sports**. Official source metadata is kept separate from local overrides so the app does not pretend one generic rulebook applies everywhere.

## Adult accounts and guardian access

The Cloudflare/Neon client supports adult account workflows through Neon Auth and the Neon Data API.

- coach/staff/guardian accounts
- team roles and team-scoped authorization
- coach and guardian invitations
- expiring join codes
- guardian-athlete linkage
- guardian-safe team-state projection
- team-scoped forms, documents, availability, and conversations

Child athletes do not need accounts.

## Offline-first sync

The coaching workspace remains local-first for field reliability.

- offline edits are retained on the device
- cloud writes use optimistic revisions
- reconnect replays queued changes
- conflicts are surfaced instead of silently overwriting another device
- team contexts remain isolated
- V1.10 uses an atomic database revision claim to prevent two-device lost updates

The remaining release gate is to prove the complete offline/reconnect collision flow against the actual Cloudflare Pages deployment with two real browser sessions.

## Secure messaging

Private message bodies are encrypted in the browser before upload.

- per-device ECDH P-256 identity keys
- HKDF-SHA256 conversation-key wrapping
- AES-GCM message encryption
- per-recipient key envelopes
- versioned historical conversation keys
- sender-key snapshots for key-rotation safety

Lost-device recovery for historical encrypted conversations remains a product/security decision before broad launch.

## Team documents and forms

Documents support visibility rules, acknowledgments, active-content rejection, and bounded Data API staging. Forms support reusable templates, assignments, required-field validation, signatures, guardian-child ownership enforcement, and submission tracking.

Large photo/video document storage should not launch on database blobs; the object-storage path still needs live scale testing.

## Little League Baseball guidance

For Little League Baseball profiles, player records can store **League Age** without requiring DOB storage. Game Day can surface pitch/rest guidance and eligibility warnings from retained Team APP game history. Coaches remain responsible for confirming current official/local rules and exceptions.

## Cloud architecture

### Frontend

- Cloudflare Pages project: `team-app`
- production build command: `npm run build`
- output directory: `dist`
- static PWA with service worker and install manifest

### Data/auth

- Neon project: `team-app`
- Neon Auth for adult sessions
- Neon Data API for browser-to-database RPC access
- one client-executable application dispatcher: `app_api(text,jsonb)`
- no direct authenticated/anonymous CRUD grants on public application tables

### Worker jobs

`worker/` contains the `team-app-jobs` Cloudflare Worker scaffold for scheduled/background notification work. Closed-app push and automatic invitation email are not yet production-complete.

## Install dependencies

Use the committed lockfile:

```bash
npm ci
```

Direct release dependencies are pinned. Browser regression tooling is pinned separately in `requirements-dev.txt`.

## Run locally

Build and serve the Cloudflare-style static output:

```bash
npm ci
npm run dev
```

For the simplest offline coaching-only preview, the source root can also be served by a basic static HTTP server, but production cloud behavior must be tested from the built `dist` output.

## Regression gate

Install browser-test tooling once:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
```

Then run:

```bash
npm test
npm run verify:release
```

The V1.10 regression suite covers state migration/fuzzing, multi-team isolation, Coach Center, sport scoring, formations/layouts, responsive/mobile behavior, accessibility, hostile input/XSS handling, heavy/extreme datasets, and cloud/service security contracts.

`npm run verify:release` additionally checks that the lockfile, service-worker cache version, PWA precache assets, manifest icons, Cloudflare output settings, production cloud bundle, and baseline security headers are aligned.

## Production smoke

Once the Pages deployment is reachable:

```bash
npm run smoke:prod -- https://team-app-6mh.pages.dev
```

There is also a phone-friendly manual GitHub Action under **Actions -> Production Smoke**. It verifies the public root page, `cloud-client.js`, `sw.js`, manifest, PWA contract, and baseline response security headers.

Passing the public smoke test does **not** replace the real-account/device staging gates in `RELEASE_READINESS.md`.

## Key project documents

- `RELEASE_READINESS.md` — launch gates and current evidence
- `HARDENING_AUDIT.md` — significant defects found/fixed in V1.10
- `TESTING.md` — local, CI, and production-smoke procedures
- `CLOUDFLARE_DEPLOYMENT.md` — Pages/Worker deployment shape
- `ROADMAP.md` — next normalization, coaching-depth, collaboration, and mobile work
- `SECURITY.md` — security model and operational expectations
