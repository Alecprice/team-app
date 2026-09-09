# Team APP Project State

Product: mobile-first multi-sport coaching and team operations app.

Priorities:
- P0: production outage, auth failure, broken deploy, data loss/corruption, failed CI.
- P1: broken roster/schedule/messaging/coaching flows, mobile usability, permissions/security regressions.
- P2: product features across sports and team operations.
- P3: polish and refactors.

Critical release checks:
- `npm run gate`
- Production smoke when runtime behavior changes
- Account smoke when auth/user flows change
- PWA smoke when install/offline/mobile shell changes
- Core coach workflow verified end-to-end

Tracked work should live in GitHub Issues and pull requests. Update this file when priorities or release assumptions materially change.