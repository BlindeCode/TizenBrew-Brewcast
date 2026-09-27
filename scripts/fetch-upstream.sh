#!/bin/bash
# Clone or update upstream FCast (futo-org/fcast) as a read-only reference
# checkout in ../fcast-upstream, next to this repo. See CLAUDE.md: never
# edit, commit or push there.
#
# Never fails: a missing network or odd state must not break a session.
set -uo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
dest="${FCAST_UPSTREAM_DIR:-$repo_root/../fcast-upstream}"
url="https://github.com/futo-org/fcast.git"

if git -C "$dest" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$dest" fetch --quiet --tags origin \
    || echo "fetch-upstream: fetch failed; using the existing clone" >&2
elif [ -e "$dest" ]; then
  echo "fetch-upstream: $dest exists but is not a git repo; leaving it alone" >&2
else
  # Blobless: full history and tags, file contents fetched on demand.
  git clone --quiet --filter=blob:none "$url" "$dest" \
    || echo "fetch-upstream: clone of $url failed" >&2
fi
exit 0
