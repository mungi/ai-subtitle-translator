#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules/terser ] || [ ! -d node_modules/yazl ]; then
  npm install
fi

npm run release
