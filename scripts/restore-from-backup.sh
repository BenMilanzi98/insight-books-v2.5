#!/bin/bash

# Restore Database from Backup Script
# This script:
# 1. Drops and recreates the database
# 2. Applies new schema migrations
# 3. Restores data from backup
#
# ⚠️ WARNING: This will DELETE all current data in the database!

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔄 Database Restore from Backup"
echo "=========================================="
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
            break
        fi
    done < .env
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found in .env${NC}"
    exit 1
fi

# Parse database components
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Show database info (mask password)
DB_INFO=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')
echo -e "${BLUE}Database: ${DB_INFO}${NC}"
echo ""

# Get backup file path
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup_file_path>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/insightbooks_backup_Feb122026.dump"
    echo "  $0 /path/to/backup.dump"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: ${BACKUP_FILE}${NC}"
    echo ""
    echo "Available backup files:"
    if [ -d "backups" ]; then
        ls -lh backups/*.dump 2>/dev/null || echo "  No .dump files found in backups/"
    fi
    exit 1
fi

echo -e "${GREEN}✅ Backup file found: ${BACKUP_FILE}${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Size: ${BACKUP_SIZE}"
echo ""

# ⚠️ CRITICAL WARNING
echo -e "${RED}⚠️  WARNING: This operation will:${NC}"
echo "  1. DROP the current database: ${DB_NAME}"
echo "  2. CREATE a new empty database"
echo "  3. Apply Prisma migrations (new schema)"
echo "  4. Restore data from backup: ${BACKUP_FILE}"
echo ""
echo -e "${RED}⚠️  ALL CURRENT DATA WILL BE LOST!${NC}"
echo ""
read -p "Type 'YES' to continue (case sensitive): " confirm

if [ "$confirm" != "YES" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${BLUE}Step 1: Creating connection to PostgreSQL server...${NC}"

# Create connection string without database name (to connect to postgres database)
DB_URL_NO_DB=$(echo "$DATABASE_URL" | sed "s|/${DB_NAME}|/postgres|" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Test connection
if ! PGPASSWORD="$DB_PASS" psql "$DB_URL_NO_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to PostgreSQL server${NC}"
    echo "Please check your DATABASE_URL in .env"
    exit 1
fi

echo -e "${GREEN}✅ Connected to PostgreSQL server${NC}"
echo ""

# Step 2: Drop and recreate database
echo -e "${BLUE}Step 2: Dropping existing database...${NC}"
PGPASSWORD="$DB_PASS" psql "$DB_URL_NO_DB" <<EOF
-- Terminate all connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();

-- Drop database
DROP DATABASE IF EXISTS "${DB_NAME}";
EOF

echo -e "${GREEN}✅ Database dropped${NC}"
echo ""

echo -e "${BLUE}Step 3: Creating new database...${NC}"
PGPASSWORD="$DB_PASS" psql "$DB_URL_NO_DB" <<EOF
CREATE DATABASE "${DB_NAME}";
EOF

echo -e "${GREEN}✅ Database created${NC}"
echo ""

# Step 4: Apply Prisma migrations
echo -e "${BLUE}Step 4: Applying Prisma migrations (creating new schema)...${NC}"
export DATABASE_URL
npx prisma migrate deploy || {
    echo -e "${RED}ERROR: Migration failed${NC}"
    echo ""
    echo "The database has been created but migrations failed."
    echo "You may need to:"
    echo "  1. Check migration files"
    echo "  2. Fix any errors"
    echo "  3. Run: npx prisma migrate deploy"
    exit 1
}

echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Step 5: Restore data from backup
echo -e "${BLUE}Step 5: Restoring data from backup...${NC}"
echo "This may take several minutes depending on backup size..."
echo ""

# Remove schema parameter for pg_restore
DB_URL_FOR_RESTORE=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Restore with options:
# -c: clean (drop) existing objects before creating
# --if-exists: don't error if object doesn't exist
# --no-owner: don't try to set ownership
# --no-acl: don't try to set access privileges
# -v: verbose
PGPASSWORD="$DB_PASS" pg_restore \
    -d "$DB_URL_FOR_RESTORE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    -v \
    "$BACKUP_FILE" 2>&1 | tee /tmp/restore.log || {
    
    # Check if it's just warnings about existing objects (which is OK)
    if grep -q "ERROR" /tmp/restore.log; then
        echo ""
        echo -e "${RED}ERROR: Restore encountered errors${NC}"
        echo "Check /tmp/restore.log for details"
        echo ""
        echo "Common issues:"
        echo "  - Schema mismatch (backup schema doesn't match new schema)"
        echo "  - Missing columns in backup data"
        echo "  - Foreign key constraint violations"
        exit 1
    else
        echo -e "${YELLOW}⚠️  Restore completed with warnings (may be normal)${NC}"
    fi
}

echo ""
echo -e "${GREEN}✅ Data restored from backup${NC}"
echo ""

# Step 6: Generate Prisma client
echo -e "${BLUE}Step 6: Generating Prisma client...${NC}"
npx prisma generate || {
    echo -e "${YELLOW}Warning: Prisma client generation had issues${NC}"
}

echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

# Step 7: Verify restoration
echo -e "${BLUE}Step 7: Verifying restoration...${NC}"
echo ""

# Check if we can query the database
if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -c "SELECT COUNT(*) FROM \"_prisma_migrations\";" > /dev/null 2>&1; then
    MIGRATION_COUNT=$(PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -t -c "SELECT COUNT(*) FROM \"_prisma_migrations\";" | tr -d ' ')
    echo -e "${GREEN}✅ Database is accessible${NC}"
    echo "   Applied migrations: ${MIGRATION_COUNT}"
else
    echo -e "${YELLOW}⚠️  Could not verify migrations table${NC}"
fi

# Try to get table count
TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
echo "   Tables in database: ${TABLE_COUNT}"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Database Restore Completed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. ✅ Restart your application:"
echo "   pm2 restart your-app-name"
echo ""
echo "2. ✅ Test your application:"
echo "   - Login"
echo "   - Check critical features"
echo "   - Verify data integrity"
echo ""
echo "3. ✅ Monitor application logs for errors"
echo ""
echo "If you encounter issues:"
echo "  - Check application logs"
echo "  - Verify data in Prisma Studio: npx prisma studio"
echo "  - Review restore log: cat /tmp/restore.log"
