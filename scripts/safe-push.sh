#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"

if [[ -z "$BRANCH" ]]; then
  echo "❌ Detached HEAD. Refusing to push."
  exit 1
fi

if [[ "$BRANCH" == "main" ]]; then
  echo "❌ Refusing to use automated safe-push from main."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is not clean."
  git status --short
  exit 1
fi

echo "========================================"
echo "TEAM APP SAFE PUSH"
echo "========================================"
echo "Branch: $BRANCH"
echo

echo "===== FETCH ====="
git fetch origin "$BRANCH"

echo
echo "===== REBASE ON REMOTE ====="
git rebase "origin/$BRANCH"

echo
echo "===== LOCAL RELEASE GATE ====="
npm run gate

echo
echo "===== PUSH ====="
git push origin "$BRANCH"

echo
echo "===== VERIFY SYNC ====="

if [[ -n "$(git log "origin/$BRANCH..HEAD" --oneline)" ]]; then
  echo "❌ Local commits remain unpushed."
  git log "origin/$BRANCH..HEAD" --oneline
  exit 1
fi

git status

echo
echo "========================================"
echo "✅ SAFE PUSH COMPLETE"
echo "========================================"
echo "Branch: $BRANCH"
echo "Commit: $(git rev-parse --short HEAD)"
echo
echo "GitHub CI was triggered automatically."
echo
echo "Check it with:"
echo "  gh run list --branch \"$BRANCH\" --limit 5"
