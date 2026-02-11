#!/bin/bash

# Safe Production Deployment Script
# This script ensures zero data loss by:
# 1. Creating a mandatory backup
# 2. Checking migration safety
# 3. Applying migrations
# 4. Verifying success

set -e  # Exit on error

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
echo "🚀 Safe Production Database Deployment"
echo "=========================================="
echo ""

# Load .env file
if [ -f .env ]; then
    echo -e "${GREEN}Loading database configuration from .env file...${NC}"
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
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables.${NC}"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found${NC}"
    exit 1
fi

# Show database info (mask password)
DB_INFO=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')
echo -e "${BLUE}Database: ${DB_INFO}${NC}"
echo ""

# Confirm this is production
echo -e "${YELLOW}⚠️  WARNING: You are about to modify the PRODUCTION database!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to continue): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Check migration status
echo ""
echo -e "${BLUE}Step 1: Checking migration status...${NC}"
echo ""
npx prisma migrate status || {
    echo -e "${RED}Failed to check migration status${NC}"
    exit 1
}

# Step 2: Safety check
echo ""
echo -e "${BLUE}Step 2: Running safety checklist...${NC}"
echo ""
if [ -f "$SCRIPT_DIR/safe-migration-checklist.sh" ]; then
    bash "$SCRIPT_DIR/safe-migration-checklist.sh" || {
        echo -e "${RED}Safety check failed or dangerous operations detected!${NC}"
        echo "Please review the migrations before proceeding."
        exit 1
    }
else
    echo -e "${YELLOW}Safety checklist script not found, skipping...${NC}"
fi

# Step 3: Create backup (MANDATORY)
echo ""
echo -e "${BLUE}Step 3: Creating database backup (MANDATORY)...${NC}"
echo ""
if [ -f "$SCRIPT_DIR/backup-database.sh" ]; then
    bash "$SCRIPT_DIR/backup-database.sh" || {
        echo -e "${RED}Backup failed! Cannot proceed without backup.${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}Backup script not found, creating manual backup...${NC}"
    mkdir -p backups
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backups/production_backup_${TIMESTAMP}.dump"
    DB_URL_FOR_DUMP=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')
    
    echo "Creating backup: ${BACKUP_FILE}"
    pg_dump "$DB_URL_FOR_DUMP" -F c -f "$BACKUP_FILE" --no-password || {
        echo -e "${RED}Backup failed!${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Backup created: ${BACKUP_FILE}${NC}"
fi

# Step 4: Show pending migrations
echo ""
echo -e "${BLUE}Step 4: Review pending migrations${NC}"
echo ""
echo "The following migrations will be applied:"
npx prisma migrate status | grep -A 100 "Following migrations" || echo "All migrations are up to date"
echo ""
read -p "Continue with deployment? (type 'yes' to continue): " deploy_confirm

if [ "$deploy_confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Step 5: Apply migrations
echo ""
echo -e "${BLUE}Step 5: Applying migrations...${NC}"
echo ""
npx prisma migrate deploy || {
    echo -e "${RED}Migration failed!${NC}"
    echo ""
    echo "To rollback:"
    echo "1. Restore from backup: pg_restore -d \"\$DATABASE_URL\" --clean --if-exists ${BACKUP_FILE}"
    echo "2. Or contact support"
    exit 1
}

# Step 6: Generate Prisma client
echo ""
echo -e "${BLUE}Step 6: Generating Prisma client...${NC}"
echo ""
npx prisma generate || {
    echo -e "${YELLOW}Warning: Prisma client generation had issues, but migration succeeded${NC}"
}

# Step 7: Verify success
echo ""
echo -e "${BLUE}Step 7: Verifying migration success...${NC}"
echo ""
npx prisma migrate status

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. ✅ Restart your application:"
echo "   pm2 restart your-app-name"
echo "   # or"
echo "   systemctl restart your-service"
echo ""
echo "2. ✅ Test critical functionality:"
echo "   - Create an invoice"
echo "   - Process a payment"
echo "   - Generate a report"
echo ""
echo "3. ✅ Monitor application logs for errors"
echo ""
echo "4. ✅ Backup location: ${BACKUP_FILE:-backups/}"
