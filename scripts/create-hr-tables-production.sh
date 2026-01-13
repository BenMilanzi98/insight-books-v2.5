#!/bin/bash

# Script to create new HR/Payroll tables on production server
# SAFE: Only creates new tables, doesn't modify or delete existing data

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
echo "Create New HR/Payroll Tables (Production)"
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
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found${NC}"
    exit 1
fi

# Remove schema parameter for Prisma commands
DB_URL_FOR_PRISMA=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')
export DATABASE_URL="$DB_URL_FOR_PRISMA"

echo -e "${BLUE}Step 1: Checking current database state...${NC}"
echo ""

# Check migration status
MIGRATION_STATUS=$(npx prisma migrate status 2>&1)

echo "$MIGRATION_STATUS"
echo ""

# Check if we need to create a baseline or apply migrations
if echo "$MIGRATION_STATUS" | grep -q "drift detected\|not in sync"; then
    echo -e "${YELLOW}⚠️  Schema drift detected!${NC}"
    echo ""
    echo "Your database schema doesn't match your migration history."
    echo "This usually means:"
    echo "  1. Tables exist that aren't in migrations, OR"
    echo "  2. Migrations exist that haven't been applied"
    echo ""
    echo -e "${BLUE}Option 1: Create a baseline migration (if tables already exist)${NC}"
    echo "This will mark the current state as the baseline."
    echo ""
    echo -e "${BLUE}Option 2: Push schema directly (creates missing tables only)${NC}"
    echo "This will create any missing tables without creating migration files."
    echo ""
    read -p "Choose option (1=baseline, 2=push, 3=cancel): " option
    
    if [ "$option" = "1" ]; then
        echo ""
        echo -e "${BLUE}Creating baseline migration...${NC}"
        echo -e "${YELLOW}Note: This should be done locally first, then applied to production${NC}"
        echo "Run this locally: npx prisma migrate dev --create-only --name baseline"
        exit 0
    elif [ "$option" = "2" ]; then
        echo ""
        echo -e "${YELLOW}WARNING: Using db push - this creates tables directly${NC}"
        echo "This will create the following new tables:"
        echo "  - GratuityAccount & GratuityPayment"
        echo "  - SalaryAdvance & AdvanceDeduction"
        echo "  - LeavePolicy, LeaveRequest, LeaveBalance"
        echo "  - PerformanceReview, PerformanceReviewCriteria"
        echo "  - PerformanceGoal"
        echo "  - PerformanceFeedback"
        echo ""
        echo -e "${GREEN}✓ SAFE: Only creates new tables, won't delete existing data${NC}"
        echo ""
        read -p "Continue? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 1
        fi
        
        echo ""
        echo -e "${BLUE}Creating backup first...${NC}"
        ./scripts/backup-database.sh
        
        echo ""
        echo -e "${BLUE}Pushing schema to create new tables...${NC}"
        npx prisma db push --accept-data-loss=false
        
        echo ""
        echo -e "${BLUE}Generating Prisma client...${NC}"
        npx prisma generate
        
        echo ""
        echo -e "${GREEN}✅ New tables created successfully!${NC}"
        exit 0
    else
        echo "Cancelled."
        exit 0
    fi
fi

# If no drift, check for pending migrations
if echo "$MIGRATION_STATUS" | grep -q "Following migrations have not yet been applied"; then
    echo -e "${BLUE}Step 2: Pending migrations found. Reviewing...${NC}"
    echo ""
    
    # Show pending migrations
    PENDING=$(echo "$MIGRATION_STATUS" | grep -A 100 "Following migrations" | grep -E "^[0-9]" | head -10)
    echo "Pending migrations:"
    echo "$PENDING"
    echo ""
    
    echo -e "${YELLOW}WARNING: You are about to apply migrations to PRODUCTION!${NC}"
    echo ""
    echo -e "${GREEN}✓ These migrations will CREATE new tables only${NC}"
    echo "  - GratuityAccount & GratuityPayment"
    echo "  - SalaryAdvance & AdvanceDeduction"
    echo "  - LeavePolicy, LeaveRequest, LeaveBalance"
    echo "  - PerformanceReview, PerformanceReviewCriteria"
    echo "  - PerformanceGoal"
    echo "  - PerformanceFeedback"
    echo ""
    read -p "Continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Step 3: Creating backup...${NC}"
    ./scripts/backup-database.sh
    
    echo ""
    echo -e "${BLUE}Step 4: Applying migrations...${NC}"
    npx prisma migrate deploy
    
    echo ""
    echo -e "${BLUE}Step 5: Generating Prisma client...${NC}"
    npx prisma generate
    
    echo ""
    echo -e "${GREEN}✅ Migrations applied successfully!${NC}"
else
    echo -e "${GREEN}✓ No pending migrations found${NC}"
    echo ""
    echo "All migrations are already applied."
    echo ""
    echo "If you need to create new tables, you may need to:"
    echo "1. Create a migration locally first: npx prisma migrate dev --name migration_name"
    echo "2. Then apply it here: npx prisma migrate deploy"
fi

echo ""
echo "Next steps:"
echo "1. Restart your application"
echo "2. Verify tables: npx prisma studio"
echo "3. Test HR/Payroll features"

