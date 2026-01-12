#!/bin/bash

# Production Deployment Script
# This script helps safely deploy database migrations to production

set -e  # Exit on error

echo "=========================================="
echo "Production Database Migration Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it with: export DATABASE_URL='postgresql://henmik:Password2030@localhost:5432/insightbooks?schema=public'"
    exit 1
fi

# Confirm this is production
echo -e "${YELLOW}WARNING: You are about to modify the PRODUCTION database!${NC}"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Check migration status
echo ""
echo -e "${GREEN}Step 1: Checking migration status...${NC}"
npx prisma migrate status

# Step 2: Show pending migrations
echo ""
echo -e "${GREEN}Step 2: Pending migrations will be applied${NC}"
read -p "Continue? (yes/no): " continue_confirm

if [ "$continue_confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Step 3: Apply migrations
echo ""
echo -e "${GREEN}Step 3: Applying migrations...${NC}"
npx prisma migrate deploy

# Step 4: Generate Prisma client
echo ""
echo -e "${GREEN}Step 4: Generating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart your application"
echo "2. Monitor for any errors"
echo "3. Test critical functionality"

