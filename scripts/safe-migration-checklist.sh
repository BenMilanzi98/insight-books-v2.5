#!/bin/bash

# Safe Migration Checklist Script
# This script helps you verify migrations are safe before applying

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
echo "Safe Migration Checklist"
echo "=========================================="
echo ""

# Load .env file
if [ -f .env ]; then
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

echo -e "${BLUE}Step 1: Checking migration status...${NC}"
echo ""
npx prisma migrate status

echo ""
echo -e "${BLUE}Step 2: Reviewing pending migrations...${NC}"
echo ""

# Find pending migrations
PENDING_MIGRATIONS=$(npx prisma migrate status 2>&1 | grep -A 100 "Following migrations have not yet been applied" | grep -E "^[0-9]" | awk '{print $1}')

if [ -z "$PENDING_MIGRATIONS" ]; then
    echo -e "${GREEN}✅ No pending migrations!${NC}"
    exit 0
fi

echo -e "${YELLOW}Pending migrations found. Reviewing SQL files...${NC}"
echo ""

DANGEROUS_FOUND=false

for migration in $PENDING_MIGRATIONS; do
    MIGRATION_DIR="prisma/migrations/${migration}"
    SQL_FILE="${MIGRATION_DIR}/migration.sql"
    
    if [ -f "$SQL_FILE" ]; then
        echo -e "${BLUE}Reviewing: ${migration}${NC}"
        
        # Check for dangerous operations
        if grep -qi "DROP TABLE\|DROP COLUMN\|DELETE FROM" "$SQL_FILE"; then
            echo -e "${RED}⚠️  WARNING: Contains DROP or DELETE operations!${NC}"
            DANGEROUS_FOUND=true
            grep -i "DROP\|DELETE" "$SQL_FILE" | head -5
        fi
        
        if grep -qi "ALTER.*TYPE\|ALTER.*DROP" "$SQL_FILE"; then
            echo -e "${RED}⚠️  WARNING: Contains ALTER operations that may cause data loss!${NC}"
            DANGEROUS_FOUND=true
            grep -i "ALTER" "$SQL_FILE" | head -5
        fi
        
        # Show safe operations
        if grep -qi "CREATE TABLE\|ADD COLUMN\|CREATE INDEX" "$SQL_FILE"; then
            echo -e "${GREEN}✓ Contains safe operations (CREATE, ADD)${NC}"
        fi
        
        echo ""
    fi
done

echo ""
if [ "$DANGEROUS_FOUND" = true ]; then
    echo -e "${RED}⚠️  DANGEROUS OPERATIONS DETECTED!${NC}"
    echo ""
    echo "Please review the migration SQL files carefully before proceeding."
    echo "Consider:"
    echo "1. Creating a backup first"
    echo "2. Testing on a staging environment"
    echo "3. Running during a maintenance window"
    echo ""
    read -p "Do you want to view the full SQL for any migration? (yes/no): " view_sql
    if [ "$view_sql" = "yes" ]; then
        echo ""
        echo "Available migrations:"
        for migration in $PENDING_MIGRATIONS; do
            echo "  - $migration"
        done
        echo ""
        read -p "Enter migration name to view: " migration_name
        if [ -f "prisma/migrations/${migration_name}/migration.sql" ]; then
            echo ""
            echo "=== SQL for ${migration_name} ==="
            cat "prisma/migrations/${migration_name}/migration.sql"
        fi
    fi
else
    echo -e "${GREEN}✓ All migrations appear safe (no DROP/DELETE operations detected)${NC}"
    echo ""
    echo "Safe to proceed with: ./scripts/deploy-to-production.sh"
fi

