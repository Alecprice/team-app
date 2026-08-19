# Team APP — Secure Multi-Sport Service V1.8

> Deployment status: NOT CURRENTLY DEPLOYED. This package is the Cloudflare Pages/Workers + Neon V1.10 hardening baseline.

Team APP is a mobile-first team-management, coaching, communication, scheduling, weather and learning PWA. Baseball remains the deepest coaching template, while the shared architecture supports Baseball, Softball, Soccer, Basketball, Football and Volleyball.

V1.8 moves the project from a single-device coaching prototype into a deployable team service while preserving offline-first coaching tools.

## Coach product

A coach can create multiple isolated teams and configure each team independently:

- sport
- team name / short name / season
- age group and division
- governing league / competition profile
- official rule source
- structured local-rule overrides
- home park/facility and weather coordinates
- team colors
- uploaded team/mascot icon
- coaching staff and roles
- roster
- team documents
- formations / lineups / rotations
- practice plan
- schedule and weather
- Game Day
- player development
- learning resources

The competition registry currently contains **183 age/division profiles across six sports**. Official source metadata is kept separate from local league overrides so Team APP does not pretend one generic rulebook applies everywhere.

## Adult accounts and team access

Production service source now includes:

- adult coach/staff/guardian account model
- email/password authentication
- magic-link authentication
- passkey-capable Better Auth adapter
- coach invitations
- guardian invitations linked to a specific roster athlete
- one-use / expiring guardian join codes
- automatic guardian-athlete relationship creation
- role-based API authorization
- coach/admin/assistant/manager/guardian/member/read-only roles
- guardian-safe team-state projection

Child athletes do not need accounts.

## Cloud/offline team sync

The browser remains local-first for field reliability. Published teams synchronize to PostgreSQL using optimistic revisions.

- offline changes queue on the device
- sync resumes when connectivity returns
- conflicts are surfaced instead of silently overwriting another device
- each team has isolated roster/schedule/lineup/practice/development/Game Day state
- coach-private notes and development data are split from weather/schedule-readable state and encrypted separately at rest

## Team documents

- PDF, PNG/JPEG/WebP, TXT/CSV and common Office document formats
- configurable coach/team/guardian/private visibility
- signed object-storage uploads/downloads in production
- upload completion state prevents half-uploaded documents from appearing
- SHA-256 metadata
- document acknowledgments
- forced attachment downloads
- HTML/SVG/active web content rejected from the document channel
- private documents are uploader-private

## Forms

- reusable form templates
- coach assignment to adult team members
- due dates
- submission tracking
- required field validation
- typed/drawn signature model
- explicit signature consent text
- drawn signature payload encryption at rest
- assignment ownership enforcement
- guardian-child relationship enforcement for athlete-linked forms

## Secure messaging

Private message bodies are encrypted in the browser before upload.

- team, coaches, event and direct adult conversations
- per-device ECDH P-256 identity keys
- HKDF-SHA256 conversation-key wrapping
- AES-GCM message encryption
- ciphertext + nonce stored on the server
- per-recipient key envelopes
- generic push notification text that does not expose private message content
- read-state tracking

## Schedule, weather and availability

- outdoor/indoor events
- NWS hourly forecasts
- official NWS alert monitoring
- automatic weather-change watch for upcoming outdoor events
- guardian **Yes / Maybe / No** response for specifically linked athletes
- coach full-roster availability view
- event availability changes are audited

## Age-specific baseball guidance

For teams configured as Little League Baseball, player profiles can store **League Age** without needing a DOB. Game Day uses that age to display current Little League daily pitch maximums and rest bands, plus eligibility warnings based on retained Team APP game history. The counter is not silently locked because official batter-threshold exceptions and local/official review still matter.

## Push notifications

Per-team notification preferences are available for:

- messages
- schedule changes
- weather alerts
- documents
- forms

The PWA service worker handles Web Push and notification navigation.

## Run the offline coaching prototype

The existing coaching UI can still be served without the Node service:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

Cloud/account features require the Node production service and a built `cloud-client.js`.

## Run the full service

```bash
npm install
npm run build
cp .env.example .env
# configure environment
npm run db:bootstrap      # fresh database only
npm run db:seed          # sport + 183 competition profiles
npm run auth:migrate     # self-hosted Better Auth schema
npm start
```

For an existing Team APP database use `npm run db:service` rather than the fresh bootstrap.

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Neon status for this project

A Neon project has been provisioned for Team APP, the V1.8 service/core tables have been initialized, and Neon managed Auth has also been provisioned as an optional managed identity path. This source build intentionally defaults to the **self-hosted Better Auth adapter** because it currently includes the passkey plugin. Do not run two identity systems as authoritative providers in one deployment.

## Test gate

```bash
npm test
```

The current V1.8 regression gate covers:

- 6 sport adapters
- 183 competition profiles
- 61 schema-table contract
- saved-state V2 → V8 migration
- malformed/corrupted save recovery
- multi-team isolation
- Coach Center workflow
- football unit isolation
- sport scoring models
- formation/layout behavior
- 66 layout combinations on 320×568
- all 6 sports on 320px, 390px, landscape and desktop
- 80-player / 24-period / 30-event / 40-activity mobile stress dataset
- cloud/service security contracts

## Build-environment note

The source package contains the complete cloud client source at `client/cloud-entry.js` and an esbuild build step. The npm registry was unreachable from the artifact-generation environment, so the checked-in `cloud-client.js` remains a development fallback. A real deployment must run `npm install && npm run build`; do not treat the fallback file as a production cloud bundle.
