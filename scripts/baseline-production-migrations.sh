#!/bin/bash
# Baseline an existing production database: mark all migrations as already applied
# without running their SQL. Use when:
#   - You get P3005 "The database schema is not empty"
#   - Your DB already has the schema (e.g. from backup/restore or prior deploy)
#   - _prisma_migrations has no rows or doesn't exist
#
# Run from project root. Requires DATABASE_URL in .env.
# After this, "npx prisma migrate deploy" will report "up to date" and future
# migrations will apply normally.

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

# Load DATABASE_URL from .env
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    if [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*= ]]; then
      DATABASE_URL="${line#*=}"
      DATABASE_URL="${DATABASE_URL#"${DATABASE_URL%%[![:space:]]*}"}"
      DATABASE_URL="${DATABASE_URL%"${DATABASE_URL##*[![:space:]]}"}"
      DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
      DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
      export DATABASE_URL
      break
    fi
  done < .env
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Set it in .env or export it."
  exit 1
fi

echo "=========================================="
echo "Baseline production migrations"
echo "=========================================="
echo "Database: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')"
echo ""
echo "This will mark all existing migration folders as APPLIED without running SQL."
echo "Only do this if your database schema already matches these migrations."
echo ""
read -p "Continue? (type 'yes'): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

MIGRATIONS_DIR="$PROJECT_ROOT/prisma/migrations"
count=0
for dir in "$MIGRATIONS_DIR"/*/; do
  name=$(basename "$dir")
  if [ "$name" = "migration_lock.toml" ] || [ ! -d "$dir" ]; then
    continue
  fi
  echo "Marking as applied: $name"
  npx prisma migrate resolve --applied "$name" || { echo "Failed on: $name"; exit 1; }
  count=$((count + 1))
done

echo ""
echo "Done. Marked $count migrations as applied."
echo "Run: npx prisma migrate status"
echo "You should see: Database schema is up to date."
echo "Then: npx prisma generate"
