#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_batch() {
  local batch_name="$1"; shift
  echo "== $batch_name =="
  local pids=() names=() logs=() status=0 i=0
  while (($#)); do
    local label="$1" script="$2"; shift 2
    local safe="${label//[^A-Za-z0-9_-]/_}"
    local log="$TMP_DIR/${safe}.log"
    python3 "$script" >"$log" 2>&1 &
    pids+=("$!"); names+=("$label"); logs+=("$log")
  done
  for i in "${!pids[@]}"; do
    if wait "${pids[$i]}"; then
      echo "-- ${names[$i]} --"
      cat "${logs[$i]}"
    else
      echo "-- ${names[$i]} FAILED --" >&2
      cat "${logs[$i]}" >&2
      status=1
    fi
  done
  return "$status"
}

echo '== Syntax =='
node --check sports.js
node --check competition-profiles.js
node --check core/file-store.js
node --check core/cloud-queue.js
node --check core/connectivity-status.js
node --check core/hardening-runtime.js
node --check core/sport-runtime.js
node --check app.js
node --check scripts/generate-sport-schema.js
node --check scripts/generate-competition-schema.js
node --check scripts/verify-release.mjs
node --check scripts/smoke-production.mjs

echo '== Registry/schema sync =='
node scripts/generate-sport-schema.js --check
node scripts/generate-competition-schema.js --check

echo '== Static and schema contracts =='
./tests/run-node-tests.sh

run_batch 'State + ownership browser contracts' \
  'Saved-state migration' tests/e2e_migration.py \
  'Malformed-state fuzz' tests/e2e_state_fuzz.py \
  'Multi-team isolation' tests/e2e_multiteam.py \
  'Coach center workflow' tests/e2e_coach_center.py \
  'Multi-unit isolation' tests/e2e_units.py

run_batch 'Adapter behavior browser contracts' \
  'Sport scoring models' tests/e2e_scoring.py \
  'Formation/layout variants' tests/e2e_layouts.py \
  'Team default layouts' tests/e2e_default_layouts.py

run_batch 'Responsive + security + stress browser contracts' \
  'Layout chaos stress' tests/e2e_layout_chaos.py \
  'Six-sport responsive smoke' tests/e2e_smoke.py \
  'Connectivity and offline status' tests/e2e_connectivity.py \
  'Runtime hardening' tests/e2e_runtime_hardening.py \
  'Hostile input / XSS' tests/e2e_xss.py \
  'Poisoned saved-state security' tests/e2e_poisoned_state.py \
  'Mobile accessibility labels' tests/e2e_accessibility.py \
  'Heavy mobile data stress' tests/e2e_stress.py \
  'Extreme season stress' tests/e2e_extreme_stress.py

echo 'ALL TEAM APP V1.10 TESTS PASSED'
