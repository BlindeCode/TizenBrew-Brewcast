#!/bin/bash
# SessionStart hook for Claude Code on the web: fetch the upstream FCast
# reference clone and install the Tizen receiver's npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
scripts/fetch-upstream.sh
(cd receivers/tizen && npm install --no-audit --no-fund)
