#!/usr/bin/env bash
#
# Pulls master and rebuilds the Tama container. Run by webhook-server.js
# with the commit SHA that passed CI.

set -euo pipefail

SHA="${1:?Usage: deploy.sh <commit-sha>}"

cd "$(dirname "$0")/.."

git fetch --quiet origin master

# Deploy only the commit that passed CI, and only if master still contains it
if ! git merge-base --is-ancestor "$SHA" origin/master; then
  echo "Commit $SHA is not on origin/master, skipping" >&2
  exit 1
fi

git checkout --quiet master
git merge --quiet --ff-only "$SHA"

docker compose up -d --build --wait --remove-orphans tama
docker image prune -f >/dev/null
