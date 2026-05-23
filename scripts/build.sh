#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Cleaning cache..."
rm -rf .next dist

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1

echo "Building the Next.js project..."
pnpm next build 2>&1

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify 2>&1

echo "Build completed successfully!"
