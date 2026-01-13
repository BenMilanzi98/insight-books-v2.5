#!/bin/bash

# Script to create new HR/Payroll tables on production server
# This creates: GratuityAccount, SalaryAdvance, LeavePolicy, LeaveRequest, 
# LeaveBalance, PerformanceReview, PerformanceGoal, PerformanceFeedback tables

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
echo "Create New HR/Payroll Tables"
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

echo -e "${BLUE}Step 1: Checking current migration status...${NC}"
npx prisma migrate status

echo ""
echo -e "${YELLOW}WARNING: You are about to create new tables on PRODUCTION!${NC}"
echo ""
echo "This will create the following new tables:"
echo "  - GratuityAccount & GratuityPayment"
echo "  - SalaryAdvance & AdvanceDeduction"
echo "  - LeavePolicy, LeaveRequest, LeaveBalance"
echo "  - PerformanceReview, PerformanceReviewCriteria"
echo "  - PerformanceGoal"
echo "  - PerformanceFeedback"
echo ""
echo -e "${GREEN}✓ These are CREATE TABLE operations - SAFE (won't delete existing data)${NC}"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Creating backup before migration...${NC}"
./scripts/backup-database.sh

echo ""
echo -e "${BLUE}Step 3: Applying migrations to create new tables...${NC}"
npx prisma migrate deploy

echo ""
echo -e "${BLUE}Step 4: Generating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${GREEN}✅ New tables created successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart your application"
echo "2. Verify tables were created: npx prisma studio"
echo "3. Test HR/Payroll features"

