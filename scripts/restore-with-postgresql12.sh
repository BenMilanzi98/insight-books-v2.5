#!/bin/bash

# Restore Backup Using PostgreSQL 12 Client
# This script uses PostgreSQL 12 pg_restore to restore backups created with PostgreSQL 12/13

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔄 Restore Backup with PostgreSQL 12"
echo "=========================================="
echo ""

# Get backup file path
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup_file_path>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/insightbooks_backup_Feb122026.dump"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backup file found: ${BACKUP_FILE}${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Size: ${BACKUP_SIZE}"
echo ""

# Find PostgreSQL 12 pg_restore
PG_RESTORE_12=""

# Check common locations
for path in \
    "/usr/pgsql-12/bin/pg_restore" \
    "/usr/bin/pg_restore-12" \
    "/usr/local/bin/pg_restore-12" \
    "$(which pg_restore-12 2>/dev/null)"; do
    if [ -f "$path" ] && [ -x "$path" ]; then
        PG_RESTORE_12="$path"
        break
    fi
done

if [ -z "$PG_RESTORE_12" ]; then
    echo -e "${RED}❌ PostgreSQL 12 pg_restore not found${NC}"
    echo ""
    echo "Please install PostgreSQL 12 client first:"
    echo "  ./scripts/install-postgresql12-client.sh"
    echo ""
    echo "Or use Docker method (see FIX_BACKUP_VERSION_MISMATCH.md)"
    exit 1
fi

echo -e "${GREEN}✅ Found PostgreSQL 12 pg_restore: ${PG_RESTORE_12}${NC}"
$PG_RESTORE_12 --version
echo ""

# Load .env file
DATABASE_URL=""
if [ -f .env ]; then
    echo -e "${BLUE}Loading DATABASE_URL from .env file...${NC}"
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
    echo -e "${YELLOW}Warning: DATABASE_URL not found in .env${NC}"
    echo "Please provide database connection details:"
    read -p "Database host [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    read -p "Database port [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Database name [insightbooks]: " DB_NAME
    DB_NAME=${DB_NAME:-insightbooks}
    read -p "Database user [henmik]: " DB_USER
    DB_USER=${DB_USER:-henmik}
    read -sp "Database password: " DB_PASS
    echo ""
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    export DATABASE_URL
fi

# Remove schema parameter
DB_URL_FOR_RESTORE=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Extract password
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo -e "${BLUE}Database: $(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')${NC}"
echo ""

# Confirm restore
echo -e "${YELLOW}⚠️  This will restore data to the database${NC}"
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Restoring backup...${NC}"
echo "This may take several minutes..."
echo ""

# Restore using PostgreSQL 12 pg_restore
if PGPASSWORD="$DB_PASS" "$PG_RESTORE_12" \
    -d "$DB_URL_FOR_RESTORE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --verbose \
    "$BACKUP_FILE" 2>&1 | tee /tmp/restore_pg12.log; then
    echo ""
    echo -e "${GREEN}✅ Restore completed successfully!${NC}"
else
    # Check if it's just warnings
    ERROR_COUNT=$(grep -i "error" /tmp/restore_pg12.log | grep -v "already exists" | grep -v "does not exist" | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Restore completed with minor warnings (normal)${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  Restore completed but had some errors${NC}"
        echo "Check /tmp/restore_pg12.log for details"
        echo ""
        echo "Critical errors:"
        grep -i "error" /tmp/restore_pg12.log | grep -v "already exists" | grep -v "does not exist" | head -10
    fi
fi

echo ""
echo -e "${BLUE}Verifying restoration...${NC}"

# Check if we can query the database
if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null 2>&1; then
    TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    echo -e "${GREEN}✅ Database is accessible${NC}"
    echo "   Tables in database: ${TABLE_COUNT}"
else
    echo -e "${YELLOW}⚠️  Could not verify database${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Restore Process Completed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. ✅ Verify data: npx prisma studio"
echo "2. ✅ Generate Prisma client: npx prisma generate"
echo "3. ✅ Restart application: pm2 restart your-app-name"
