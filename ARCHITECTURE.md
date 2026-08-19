# Team APP V1.9 Architecture

## Product layers

```text
Mobile PWA / installed web app
        │
        ├── Offline coaching core
        │   ├── sport adapters
        │   ├── team contexts
        │   ├── lineup / formation engine
        │   ├── practice / learning
        │   └── Game Day
        │
        ├── Cloud collaboration client
        │   ├── adult authentication
        │   ├── offline sync queue
        │   ├── secure documents/forms
        │   ├── guardian availability
        │   └── client-side E2EE messaging
        │
        ▼
Node / Express Team APP API
        │
        ├── role authorization
        ├── optimistic team-state sync
        ├── invitation/join-code service
        ├── form/document APIs
        ├── notification service
        ├── weather monitor
        └── encrypted-message transport
        │
        ├──────────► Private S3-compatible object storage
        │
        ▼
Neon PostgreSQL
```

## Sport-adapter boundary

Baseball is a sport adapter, not the application architecture. Shared concepts include:

- roster
- athlete availability
- playing surface
- units
- formations/layouts
- periods/innings/quarters/sets
- lineup/rotation assignments
- scoring models
- practices
- learning
- schedules
- weather
- Game Day

The sport registry currently defines 6 sports, 73 unit-position definitions and 22 layouts.

## Team ownership boundary

Every team owns its own context. Team switching cannot carry another team's roster, events, lineups, practices, development data, weather, documents or Game Day history.

## Cloud synchronization boundary

V1.9 uses a compatibility snapshot while the prototype migrates toward fully relational cloud records.

### Public operational snapshot

Server-readable fields needed for ordinary team operations and automation, such as:

- event schedule
- weather location
- availability-compatible roster state
- non-sensitive lineup/sport state used by authorized coaches

### Coach-private state

Separated and encrypted at rest:

- coach player notes
- development/evaluation state

This prevents the weather scheduler from needing access to private coaching notes.

## Identity boundary

The application owns Team APP roles and memberships separately from the authentication provider.

The source defaults to self-hosted Better Auth in a dedicated `auth` schema so passkey support can be enabled without mixing authentication tables with Team APP tables. The Neon project also has managed Neon Auth provisioned as an optional future identity path.

## Youth account model

Athletes are profiles, not authentication accounts. Adult guardian accounts can be linked to one or more athlete profiles with explicit permissions for messages, availability and forms.

## Messaging crypto boundary

Message plaintext is not required by the application server.

1. device creates a non-extractable ECDH P-256 identity key
2. conversation AES key is generated client-side
3. key is wrapped separately for eligible conversation members
4. message body is AES-GCM encrypted client-side
5. server stores ciphertext, nonce and key envelopes
6. push notification contains only generic message metadata

## Documents

Document bytes do not live in Postgres. Postgres stores metadata and a private object-storage key. Production uploads use short-lived signed URLs with server-side storage encryption and forced attachment downloads.

## Forms

Form templates and JSON answers are server-readable so workflow/required-field validation works. Drawn signature payloads are encrypted at rest. Assignment and guardian-child authorization is enforced at the API.

## Weather automation

The weather monitor intentionally reads event time/location from the operational snapshot. It checks upcoming outdoor events and only queues a notification when the forecast/alert state changes meaningfully.

## Current migration strategy

The offline PWA remains functional while cloud records are introduced. V1.9 uses revisioned team snapshots as a compatibility bridge. The long-term schema in `schema.sql` retains relational lineup, game, practice, learning and sport tables so high-value cloud workflows can be normalized incrementally without forcing a rewrite of the coaching UX.
