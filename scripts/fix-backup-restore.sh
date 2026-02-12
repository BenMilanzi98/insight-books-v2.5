#!/bin/bash

# Fix Backup Restore - Handle Version Mismatch
# This script helps restore backups when there's a version mismatch

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔧 Fix Backup Restore - Version Mismatch"
echo "=========================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

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
    echo -e "${RED}ERROR: DATABASE_URL not found${NC}"
    exit 1
fi

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

echo -e "${BLUE}Step 1: Checking PostgreSQL versions...${NC}"
echo ""

# Check PostgreSQL server version
PSQL_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1 || echo "unknown")
echo "PostgreSQL Server Version: ${PSQL_VERSION}"

# Check pg_restore version
PG_RESTORE_VERSION=$(pg_restore --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1 || echo "unknown")
echo "pg_restore Version: ${PG_RESTORE_VERSION}"

# Check backup file version
echo ""
echo -e "${BLUE}Step 2: Checking backup file format...${NC}"
BACKUP_FORMAT=$(pg_restore --list "$BACKUP_FILE" 2>&1 | head -1 || echo "")
echo "Backup format info: ${BACKUP_FORMAT}"

echo ""
echo -e "${BLUE}Step 3: Attempting restore with different methods...${NC}"
echo ""

# Remove schema parameter for restore
DB_URL_FOR_RESTORE=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Extract password for PGPASSWORD
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Method 1: Try with --no-version-check flag (if available)
echo -e "${YELLOW}Method 1: Trying restore with compatibility flags...${NC}"
if PGPASSWORD="$DB_PASS" pg_restore \
    -d "$DB_URL_FOR_RESTORE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --verbose \
    "$BACKUP_FILE" 2>&1 | tee /tmp/restore_attempt1.log; then
    echo -e "${GREEN}✅ Restore successful with Method 1!${NC}"
    exit 0
fi

# Check if it's a version error
if grep -q "unsupported version" /tmp/restore_attempt1.log; then
    echo -e "${RED}❌ Version mismatch confirmed${NC}"
    echo ""
    echo -e "${BLUE}Step 4: Converting backup format...${NC}"
    echo ""
    
    # Method 2: Try to use psql to restore (if backup is in SQL format)
    echo -e "${YELLOW}Method 2: Checking if we can extract SQL from backup...${NC}"
    
    # Try to list contents
    if pg_restore --list "$BACKUP_FILE" > /tmp/backup_list.txt 2>&1; then
        echo -e "${GREEN}✅ Can read backup file structure${NC}"
        echo ""
        echo -e "${BLUE}Step 5: Using alternative restore method...${NC}"
        echo ""
        
        # Method 3: Restore using psql with SQL dump
        echo -e "${YELLOW}Method 3: Converting to SQL format and restoring...${NC}"
        
        # Convert custom format to SQL
        if pg_restore "$BACKUP_FILE" > /tmp/backup.sql 2>/dev/null; then
            echo -e "${GREEN}✅ Converted to SQL format${NC}"
            echo "Restoring SQL dump..."
            
            if PGPASSWORD="$DB_PASS" psql "$DB_URL_FOR_RESTORE" -f /tmp/backup.sql 2>&1 | tee /tmp/restore_sql.log; then
                echo -e "${GREEN}✅ Restore successful using SQL method!${NC}"
                rm -f /tmp/backup.sql
                exit 0
            else
                echo -e "${YELLOW}⚠️  SQL restore had some errors, but may have partially succeeded${NC}"
                echo "Check /tmp/restore_sql.log for details"
            fi
        else
            echo -e "${RED}❌ Could not convert backup to SQL${NC}"
        fi
    fi
fi

# Method 4: Try with different pg_restore binary
echo ""
echo -e "${BLUE}Step 6: Looking for alternative pg_restore binaries...${NC}"

# Check for other PostgreSQL installations
ALTERNATIVE_PG_RESTORE=""
for pg_path in /usr/bin/pg_restore /usr/local/bin/pg_restore /opt/postgresql*/bin/pg_restore; do
    if [ -f "$pg_path" ] && [ "$pg_path" != "$(which pg_restore)" ]; then
        echo "Found alternative: $pg_path"
        ALTERNATIVE_PG_RESTORE="$pg_path"
        break
    fi
done

if [ -n "$ALTERNATIVE_PG_RESTORE" ]; then
    echo -e "${YELLOW}Trying with alternative pg_restore: ${ALTERNATIVE_PG_RESTORE}${NC}"
    if PGPASSWORD="$DB_PASS" "$ALTERNATIVE_PG_RESTORE" \
        -d "$DB_URL_FOR_RESTORE" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        "$BACKUP_FILE" 2>&1 | tee /tmp/restore_alt.log; then
        echo -e "${GREEN}✅ Restore successful with alternative pg_restore!${NC}"
        exit 0
    fi
fi

# Final recommendation
echo ""
echo "=========================================="
echo -e "${RED}❌ Automatic restore failed${NC}"
echo "=========================================="
echo ""
echo "The backup file was created with a different PostgreSQL version."
echo ""
echo "Solutions:"
echo ""
echo "1. Install matching PostgreSQL client version:"
echo "   - Backup was created with PostgreSQL 12/13 (format 1.14)"
echo "   - Install matching pg_restore version"
echo ""
echo "2. Recreate backup with current PostgreSQL version:"
echo "   - If you have access to the source database"
echo "   - Create new backup: pg_dump -F c -f new_backup.dump DATABASE_URL"
echo ""
echo "3. Use Docker with matching PostgreSQL version:"
echo "   docker run --rm -v \$(pwd):/backup postgres:12 pg_restore ..."
echo ""
echo "4. Manual SQL extraction (if possible):"
echo "   pg_restore backup.dump > backup.sql"
echo "   psql DATABASE_URL < backup.sql"
echo ""
echo "Check logs:"
echo "  - /tmp/restore_attempt1.log"
echo "  - /tmp/restore_sql.log (if created)"

exit 1
