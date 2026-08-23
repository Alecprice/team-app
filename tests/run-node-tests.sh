#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --check sports.js
node --check sport-content.js
node --check competition-profiles.js
node --check core/file-store.js
node --check app.js
node tests/sport-registry.test.js
node tests/sport-content.test.js
node tests/competition-profiles.test.js
node tests/core-runtime.test.js
node tests/static-contract.test.js
node tests/schema-contract.test.js
node tests/state-contract.test.js
