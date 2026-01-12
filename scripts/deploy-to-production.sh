#!/bin/bash

# Production Deployment Script
# This script helps safely deploy database migrations to production

set -e  # Exit on error

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

echo "=========================================="
echo "Production Database Migration Script"
echo "=========================================="
echo "Working directory: $PROJECT_ROOT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading database configuration from .env file...${NC}"
    # Use a safer method to load .env (handles values with spaces)
    set -a
    source .env
    set +a
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables.${NC}"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found in .env or environment variables${NC}"
    echo "Please ensure DATABASE_URL is set in your .env file or as an environment variable"
    exit 1
fi

# Confirm this is production
echo -e "${YELLOW}WARNING: You are about to modify the PRODUCTION database!${NC}"
# Show database info (hide password)
DB_INFO=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')
echo "Database: ${DB_INFO}"
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

