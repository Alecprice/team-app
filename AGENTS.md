# Repository Development Workflow

TENX is the standard development workflow for this project.

## Workflow
1. Review repository state, recent pull requests, CI results, production checks, and `.tenx/PROJECT.md`.
2. Verify current external platform/API/security details from primary documentation when they affect the change.
3. Prioritize production failures first, then reliability/usability, feature work, and polish/refactoring.
4. Use a dedicated branch and keep each pull request focused on one coherent outcome.
5. Run `npm run gate` for code changes, plus the relevant production/account/PWA smoke checks when runtime behavior is affected.
6. Verify the critical coach/team workflow before calling a runtime-facing change complete.
7. Pull requests should state the problem, implementation, verification, risks, and rollback path.
8. Update `.tenx/PROJECT.md` when priorities, critical flows, or release assumptions materially change.

## Engineering rules
- Preserve working production behavior unless a task intentionally changes it.
- Prefer root-cause fixes with regression coverage.
- Keep credentials, tokens, local secrets, and production data out of source control.
- Reuse existing Cloudflare/Workers/Pages release checks rather than replacing them with weaker gates.

## Completion standard
Work is complete when the intended outcome is implemented, relevant checks pass or any failure is understood and documented, and runtime behavior is verified where practical.