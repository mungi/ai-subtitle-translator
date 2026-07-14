#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules/terser ] || [ ! -d node_modules/yazl ]; then
  npm install
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required to publish the release." >&2
  exit 1
fi

npm run release

tag="$(git describe --tags --exact-match HEAD)"
zip_path="release/ai-subtitle-translator-${tag}.zip"

if gh release view "$tag" >/dev/null 2>&1; then
  gh release upload "$tag" "$zip_path" --clobber
else
  gh release create "$tag" "$zip_path" --title "$tag" --generate-notes
fi
