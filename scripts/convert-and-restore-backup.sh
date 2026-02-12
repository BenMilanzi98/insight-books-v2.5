#!/bin/bash

# Convert and Restore Backup - Handles Version Mismatch
# Converts custom format backup to SQL and restores it

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔄 Convert & Restore Backup (Version Fix)"
echo "=========================================="
echo ""

# Get backup file path
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup_file_path>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/insightbooks_backup_Feb122026dev.dump"
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

# Load .env file for DATABASE_URL
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

# Remove schema parameter for psql
DB_URL_FOR_PSQL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Extract password
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo -e "${BLUE}Step 1: Converting backup to SQL format...${NC}"
echo "This may take a few minutes..."
echo ""

SQL_FILE="/tmp/backup_$(date +%Y%m%d_%H%M%S).sql"

# Try to convert using pg_restore (even with version mismatch, this might work for listing)
# If that fails, we'll try alternative methods

echo "Attempting to extract SQL from backup..."
if PGPASSWORD="$DB_PASS" pg_restore "$BACKUP_FILE" > "$SQL_FILE" 2>/tmp/convert_error.log; then
    echo -e "${GREEN}✅ Successfully converted to SQL${NC}"
    SQL_SIZE=$(du -h "$SQL_FILE" | cut -f1)
    echo "   SQL file size: ${SQL_SIZE}"
else
    # Check if it's just a version warning but still produced output
    if [ -f "$SQL_FILE" ] && [ -s "$SQL_FILE" ]; then
        echo -e "${YELLOW}⚠️  Conversion had warnings but produced SQL file${NC}"
        SQL_SIZE=$(du -h "$SQL_FILE" | cut -f1)
        echo "   SQL file size: ${SQL_SIZE}"
    else
        echo -e "${RED}❌ Could not convert backup to SQL${NC}"
        echo ""
        echo "Error details:"
        cat /tmp/convert_error.log
        echo ""
        echo "Trying alternative method..."
        
        # Try with --no-version-check if available (PostgreSQL 13+)
        if PGPASSWORD="$DB_PASS" pg_restore --no-version-check "$BACKUP_FILE" > "$SQL_FILE" 2>/tmp/convert_error2.log; then
            echo -e "${GREEN}✅ Converted using --no-version-check flag${NC}"
        else
            echo -e "${RED}❌ All conversion methods failed${NC}"
            echo ""
            echo "Solutions:"
            echo "1. Install PostgreSQL 12 client: sudo yum install postgresql12"
            echo "2. Use Docker: docker run --rm -v \$(pwd):/backup postgres:12 pg_restore ..."
            echo "3. Recreate backup with current PostgreSQL version"
            exit 1
        fi
    fi
fi

echo ""
echo -e "${BLUE}Step 2: Reviewing SQL file (first 20 lines)...${NC}"
head -20 "$SQL_FILE"

echo ""
read -p "Continue with restore? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted. SQL file saved at: $SQL_FILE"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 3: Restoring SQL to database...${NC}"
echo "This may take several minutes..."
echo ""

# Restore SQL file
if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_PSQL" -f "$SQL_FILE" 2>&1 | tee /tmp/restore_sql.log; then
    echo ""
    echo -e "${GREEN}✅ Restore completed!${NC}"
else
    # Check if it's just warnings about existing objects
    ERROR_COUNT=$(grep -i "error" /tmp/restore_sql.log | grep -v "already exists" | grep -v "does not exist" | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Restore completed with minor warnings (normal)${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  Restore completed but had some errors${NC}"
        echo "Check /tmp/restore_sql.log for details"
        echo ""
        echo "Critical errors:"
        grep -i "error" /tmp/restore_sql.log | grep -v "already exists" | grep -v "does not exist" | head -10
    fi
fi

echo ""
echo -e "${BLUE}Step 4: Verifying restoration...${NC}"

# Check if we can query the database
if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_PSQL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null 2>&1; then
    TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_PSQL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    echo -e "${GREEN}✅ Database is accessible${NC}"
    echo "   Tables in database: ${TABLE_COUNT}"
    
    # Try to get some record counts
    if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_PSQL" -c "SELECT COUNT(*) FROM \"User\";" > /dev/null 2>&1; then
        USER_COUNT=$(PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_PSQL" -t -c "SELECT COUNT(*) FROM \"User\";" | tr -d ' ')
        echo "   Users: ${USER_COUNT}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not verify database${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Restore Process Completed!${NC}"
echo "=========================================="
echo ""
echo "SQL file location: ${SQL_FILE}"
echo "(You can delete it after verifying the restore)"
echo ""
echo "Next steps:"
echo "1. ✅ Verify data: npx prisma studio"
echo "2. ✅ Generate Prisma client: npx prisma generate"
echo "3. ✅ Restart application: pm2 restart your-app-name"
echo ""
echo "To clean up SQL file:"
echo "  rm ${SQL_FILE}"
