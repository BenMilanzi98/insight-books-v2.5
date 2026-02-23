#!/bin/bash
# Create a .dump backup that is compatible with older pg_restore (e.g. on server).
# Uses Docker with postgres:18 so the archive format matches server's pg_restore.
#
# Usage: ./scripts/create-dump-compatible.sh [output_file]
# Example: ./scripts/create-dump-compatible.sh localdb.dump
# Requires: Docker, DATABASE_URL in .env

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

OUTPUT="${1:-localdb.dump}"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Need DATABASE_URL."
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found in .env"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install Docker or use pg_dump directly (dump may then fail to restore on server with 'unsupported version')."
  exit 1
fi

# Parse for Docker (host might be localhost or host.docker.internal)
if [[ "$DB_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]*) ]]; then
  PGUSER="${BASH_REMATCH[1]}"
  PGPASS="${BASH_REMATCH[2]}"
  PGHOST="${BASH_REMATCH[3]}"
  PGPORT="${BASH_REMATCH[4]}"
  PGDB="${BASH_REMATCH[5]}"
else
  echo "ERROR: Could not parse DATABASE_URL"
  exit 1
fi

# From inside Docker: use host.docker.internal for Mac/Win, or --network host for Linux localhost
echo "Creating compatible dump: $OUTPUT"
echo "Database: $PGHOST:$PGPORT/$PGDB"
echo ""

if [ "$PGHOST" = "localhost" ] || [ "$PGHOST" = "127.0.0.1" ]; then
  docker run --rm --network host \
    -v "$PROJECT_ROOT:/out" \
    -e PGPASSWORD="$PGPASS" \
    postgres:18 \
    pg_dump -h localhost -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -F c -f "/out/$OUTPUT" --no-password
else
  docker run --rm \
    -v "$PROJECT_ROOT:/out" \
    -e PGPASSWORD="$PGPASS" \
    postgres:18 \
    pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -F c -f "/out/$OUTPUT" --no-password
fi

echo "Done. File: $PROJECT_ROOT/$OUTPUT"
ls -lh "$OUTPUT"
