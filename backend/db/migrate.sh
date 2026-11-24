#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (e.g. postgres://creatorstudio:pw@127.0.0.1:5432/creatorstudio)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for file in "$SCRIPT_DIR"/migrations/*.sql; do
  echo "Applying $(basename "$file")..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
echo "All migrations applied cleanly."
