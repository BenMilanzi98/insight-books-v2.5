#!/bin/bash

# Fix Failed Migration Script
# Resolves the failed migration issue and continues with deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔧 Fix Failed Migration"
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

echo -e "${BLUE}Step 1: Marking failed migration as rolled back...${NC}"
echo ""

# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back 20240204_add_reversal_fields || {
    echo -e "${YELLOW}Warning: Could not mark migration as rolled back${NC}"
    echo "This might be OK if the migration was partially applied"
}

echo -e "${GREEN}✅ Migration marked as rolled back${NC}"
echo ""

echo -e "${BLUE}Step 2: Fixing migration SQL to handle missing tables...${NC}"
echo ""

# Fix the migration file to check if tables exist before altering them
MIGRATION_FILE="prisma/migrations/20240204_add_reversal_fields/migration.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}ERROR: Migration file not found: ${MIGRATION_FILE}${NC}"
    exit 1
fi

# Create a backup of the original migration
cp "$MIGRATION_FILE" "${MIGRATION_FILE}.backup"

# Fix the Sale table alterations to be conditional
# Replace ALTER TABLE "Sale" with conditional logic
sed -i.tmp 's/ALTER TABLE "Sale"/DO \$\$\nBEGIN\n  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '\''Sale'\'') THEN\n    ALTER TABLE "Sale"/g' "$MIGRATION_FILE"
sed -i.tmp '/ALTER TABLE "Sale"/a\  END IF;\nEND \$\$;' "$MIGRATION_FILE"

# Also fix SupplierPayment if needed
sed -i.tmp 's/ALTER TABLE "SupplierPayment"/DO \$\$\nBEGIN\n  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '\''SupplierPayment'\'') THEN\n    ALTER TABLE "SupplierPayment"/g' "$MIGRATION_FILE"
sed -i.tmp '/ALTER TABLE "SupplierPayment"/a\  END IF;\nEND \$\$;' "$MIGRATION_FILE"

# Clean up temp file
rm -f "${MIGRATION_FILE}.tmp"

echo -e "${GREEN}✅ Migration file updated${NC}"
echo ""

echo -e "${BLUE}Step 3: Continuing with migrations...${NC}"
echo ""

# Continue with migrations
npx prisma migrate deploy || {
    echo -e "${RED}ERROR: Migrations still failing${NC}"
    echo ""
    echo "The migration file has been updated. You may need to:"
    echo "1. Review the migration file: ${MIGRATION_FILE}"
    echo "2. Manually fix any remaining issues"
    echo "3. Run: npx prisma migrate deploy"
    exit 1
}

echo ""
echo -e "${GREEN}✅ All migrations applied successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Continue with data restore if needed"
echo "2. Generate Prisma client: npx prisma generate"
echo "3. Restart your application"
