#!/bin/bash
# Regenerate the FCast v4 FlatBuffers TypeScript from receivers/common/web/v4/fcast.fbs.
# Needs flatc on PATH (or FLATC=/path/to/flatc) at the same version as the `flatbuffers` npm
# package in package.json. Uses GNU sed.
set -euo pipefail

cd "$(dirname "$0")/../../common/web/v4"
flatc="${FLATC:-flatc}"

rm -rf generated
"$flatc" --ts -o generated fcast.fbs

# Match this repo's import conventions: node packages go through the `modules/` alias
# (receivers/common has no node_modules of its own), and imports have no `.js` suffix.
find generated -name '*.ts' -exec sed -i -E \
    -e "s#from 'flatbuffers'#from 'modules/flatbuffers'#" \
    -e "s#from '(\.[^']*)\.js'#from '\1'#" {} +
