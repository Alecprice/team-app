# Team APP V1.8 Testing

## One-command regression gate

```bash
npm test
```

The browser/core suite does not require the production cloud dependencies. Service contract tests are static/contract-focused when npm dependencies are unavailable.

## Latest full regression result

```text
Sport registry/schema sync             PASS
Competition profile sync (183)         PASS
Shared runtime                         PASS
Schema contract (61 tables)            PASS
V2 -> V8 state migration               PASS
Malformed-state fuzz                   PASS
Multi-team isolation                   PASS
Coach Center workflow                  PASS
Football unit isolation                PASS
Sport scoring models                   PASS
Formation/layout variants              PASS
Team default layouts                   PASS
66-layout chaos @ 320x568               PASS
6 sports x 4 viewport classes          PASS
80-player heavy mobile stress          PASS
Page errors                            0
Service/security contract tests        13/13 PASS
```

Heavy dataset:

- 80 players
- 24 periods
- 30 events
- 40 practice activities
- 390×844 viewport

Latest measured render times in this environment were approximately:

- roster: 134 ms
- rotation: 244 ms
- practice: 112 ms
- schedule: 134 ms
- Game Day: 238 ms

These are regression measurements, not production performance guarantees.

## Cloud integration testing still required after dependency install

The artifact-generation environment could not reach the npm registry, so the Better Auth/esbuild cloud bundle was not runtime-installed here. After `npm install && npm run build`, staging must exercise:

- create adult account
- sign in/out
- magic-link delivery
- passkey registration/sign-in
- publish team
- second-device sync/conflict flow
- invite guardian linked to child
- redeem guardian join code
- upload/download/acknowledge document through actual object storage
- assign/submit/sign form
- direct E2EE conversation between two separate adult devices
- Web Push subscription and category preferences
- weather cron notification
- guardian event availability
