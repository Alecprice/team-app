# Team APP Roadmap — after V1.10 Hardening

## Implemented baseline

- six sport adapters
- age/division/league competition profiles
- Coach Center
- team branding/icon/staff/location/local rules
- isolated team workspaces
- lineups/formations/rotations
- practice/learning framework
- schedules/weather/Game Day
- adult account service source
- coach/guardian invitations and join codes
- guardian-athlete links
- cloud sync with conflict detection
- secure team documents + acknowledgments
- forms + signatures + assignment tracking
- E2EE message transport/client crypto
- push notification preferences
- weather-change monitoring
- guardian event availability
- Little League Baseball age-based pitch/rest guidance
- production Docker/deployment scripts

## Release gates before real-family launch

- materialize the exact V1.10 source in GitHub and generate/commit `package-lock.json`
- deploy the candidate to Cloudflare Pages over HTTPS and verify real response headers
- apply the QA-verified Neon V1.10 upgrade to staging before production
- complete real Neon Auth/Data API HTTP tests
- complete two-device concurrency and offline/reconnect tests
- decide E2EE lost-device recovery requirements
- decide whether coach-private notes require client-side encryption
- validate closed-app Web Push before enabling it for families

## Next normalization pass

Move high-volume cloud workflows from compatibility snapshots into their existing relational tables:

1. events + attendance/availability
2. lineups / lineup periods / assignments
3. Game Day sessions and scoring
4. practices / drills / attendance
5. development goals

The client UX should not change during this migration.

## Next coaching depth

### Baseball
- pitcher appearance calendar and cross-game eligibility dashboard
- catcher/pitcher threshold workflow
- league-specific mandatory play helper
- scorebook
- post-game recap
- interactive situational baseball
- coach whiteboard / playbook

### Other sports
- governing-body reviewed rule packs
- sport-specific practice/drill content
- competition-format constraints
- additional formations/rotations
- sport-specific Game Day stat modules

## Collaboration

- team announcements
- scheduled messages
- file attachments in encrypted conversations
- message key/device recovery strategy
- form templates by sport/league
- bulk guardian invitations
- document acknowledgment dashboards
- volunteer/team-task signups

## Mobile distribution

After PWA field validation:

- Capacitor wrapper
- APNs / FCM native push bridge
- camera/file integrations where native materially improves UX
- Apple/Google store packaging

Keep the web/PWA as a first-class install path.
