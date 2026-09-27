#!/bin/bash
# Builds the TizenBrew module into module/ at the repository root: the pages and assets TizenBrew
# serves (root package.json `appPath`) and the service bundle (`serviceFile`). TizenBrew fetches
# these through jsDelivr, so they have to be reachable in the repository (or npm package) that
# users add. Set BREWCAST_MODULE if that isn't gh/BlindeCode/tizenbrew-brewcast.
set -euo pipefail

cd "$(dirname "$0")/.."
npm run build

module="$(cd ../.. && pwd)/module"
rm -rf "$module"
mkdir -p "$module"
cp -r dist/main_window dist/player dist/viewer dist/assets dist/service "$module/"
echo "TizenBrew module written to $module"
