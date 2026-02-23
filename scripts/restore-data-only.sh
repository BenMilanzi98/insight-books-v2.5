#!/bin/bash

# Restore DATA ONLY from a backup into the local database.
# - Does NOT drop tables or schema.
# - Truncates all tables in public schema, then restores data from the backup.
# Use this to replace local data with backup data while keeping your existing schema.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "📥 Restore data only (no table drops)"
echo "=========================================="
echo ""

# Load DATABASE_URL from .env
if [ -f .env ]; then
    echo -e "${BLUE}Loading DATABASE_URL from .env...${NC}"
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        if [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*= ]]; then
            DATABASE_URL="${line#*=}"
            DATABASE_URL="${DATABASE_URL#"${DATABASE_URL%%[![:space:]]*}"}"
            DATABASE_URL="${DATABASE_URL%"${DATABASE_URL##*[![:space:]]}"}"
            DATABASE_URL="${DATABASE_URL%\"}"
            DATABASE_URL="${DATABASE_URL#\"}"
            DATABASE_URL="${DATABASE_URL%\'}"
            DATABASE_URL="${DATABASE_URL#\'}"
            export DATABASE_URL
            break
        fi
    done < .env
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found in .env${NC}"
    exit 1
fi

# Backup file: first argument or default
BACKUP_FILE="${1:-backups/insightbooks_backup_Feb192026.dump}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: ${BACKUP_FILE}${NC}"
    echo ""
    echo "Usage: $0 [backup_file]"
    echo "Example: $0 backups/insightbooks_backup_Feb192026.dump"
    if [ -d "backups" ]; then
        echo ""
        echo "Available backups:"
        ls -lh backups/*.dump 2>/dev/null || true
    fi
    exit 1
fi

# Parse DB URL for psql/pg_restore (strip ?schema=)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')
if [[ "$DB_URL_CLEAN" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]*) ]]; then
    export PGPASSWORD="${BASH_REMATCH[2]}"
    DB_USER="${BASH_REMATCH[1]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo -e "${RED}ERROR: Could not parse DATABASE_URL${NC}"
    exit 1
fi

echo -e "${GREEN}Backup file: ${BACKUP_FILE}${NC}"
echo -e "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Truncate all tables in the public schema (data only, tables stay)."
echo "  2. Restore data from the backup into those tables."
echo ""
echo -e "${RED}All current data in your local database will be replaced.${NC}"
echo ""
read -p "Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${BLUE}Step 1: Truncating all tables in public schema...${NC}"

# Get all table names (double-quoted for Prisma/Postgres case-sensitive names)
TABLES=$(PGPASSWORD="$PGPASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
  SELECT '\"' || tablename || '\"' 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename;
" 2>/dev/null | tr '\n' ',' | sed 's/,$//')

if [ -z "$TABLES" ]; then
    echo -e "${YELLOW}No tables found in public schema (empty or not connected).${NC}"
else
    PGPASSWORD="$PGPASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE $TABLES CASCADE;" || {
        echo -e "${RED}Truncate failed. Check connection and permissions.${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Tables truncated.${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Converting backup to SQL and restoring (FKs disabled during load)...${NC}"

TMP_SQL="/tmp/restore_data_$$.sql"
# Extract data as SQL from custom-format dump
PGPASSWORD="$PGPASSWORD" pg_restore --data-only --no-owner --no-acl -f "$TMP_SQL" "$BACKUP_FILE" 2>>/tmp/restore_data_only.log || true

# If native pg_restore failed due to unsupported archive version, try Docker (newer pg_restore)
if [ ! -f "$TMP_SQL" ] || [ ! -s "$TMP_SQL" ]; then
  if grep -q "unsupported version" /tmp/restore_data_only.log 2>/dev/null; then
    echo -e "${YELLOW}Native pg_restore doesn't support this dump format. Trying with Docker (postgres:latest)...${NC}"
    BACKUP_ABS="$(cd "$(dirname "$BACKUP_FILE")" 2>/dev/null && pwd)/$(basename "$BACKUP_FILE")"
    BACKUP_ABS="${BACKUP_ABS:-$PROJECT_ROOT/$BACKUP_FILE}"
    BACKUP_DIR="$(dirname "$BACKUP_ABS")"
    TMP_SQL_DOCKER="$BACKUP_DIR/restore_data_docker_$$.sql"
    if command -v docker >/dev/null 2>&1; then
      if docker run --rm -v "$BACKUP_DIR:/backup" postgres:latest pg_restore --data-only --no-owner --no-acl -f "/backup/restore_data_docker_$$.sql" "/backup/$(basename "$BACKUP_FILE")" 2>>/tmp/restore_data_only.log; then
        TMP_SQL="$TMP_SQL_DOCKER"
      fi
    fi
    if [ ! -f "$TMP_SQL" ] || [ ! -s "$TMP_SQL" ]; then
      echo -e "${RED}Docker restore failed or Docker not available.${NC}"
      echo -e "${YELLOW}Create the dump with a matching pg_dump version, e.g. on the source machine:${NC}"
      echo '  docker run --rm -v $(pwd):/out -e PGPASSWORD postgres:18 pg_dump -h host -U user -d dbname -F c -f /out/localdb.dump'
      rm -f "$TMP_SQL_DOCKER"
      exit 1
    fi
  else
    echo -e "${RED}Failed to convert backup to SQL. Check /tmp/restore_data_only.log${NC}"
    rm -f "$TMP_SQL"
    exit 1
  fi
fi

if [ -f "$TMP_SQL" ] && [ -s "$TMP_SQL" ]; then
  (echo "SET session_replication_role = replica;"; cat "$TMP_SQL"; echo "SET session_replication_role = DEFAULT;") | PGPASSWORD="$PGPASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 2>&1 | tee -a /tmp/restore_data_only.log
  rm -f "$TMP_SQL" "$BACKUP_DIR/restore_data_docker_$$.sql" 2>/dev/null
  echo -e "${GREEN}✅ Data restore completed.${NC}"
else
  echo -e "${RED}Failed to convert backup to SQL. Check /tmp/restore_data_only.log${NC}"
  rm -f "$TMP_SQL"
  exit 1
fi

# pg_restore --data-only often exits with 1 due to harmless errors (e.g. sequence restores)
if grep -q "ERROR:" /tmp/restore_data_only.log; then
    echo ""
    echo -e "${YELLOW}⚠️  Some errors occurred. Check /tmp/restore_data_only.log${NC}"
    echo "Common harmless errors: duplicate key (if backup had partial data), or missing tables."
else
    echo -e "${GREEN}✅ Data restore completed.${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Done.${NC} Tables unchanged; data replaced from backup."
echo "=========================================="
echo ""
echo "Optional: npx prisma generate"
echo "Log: /tmp/restore_data_only.log"
echo ""
