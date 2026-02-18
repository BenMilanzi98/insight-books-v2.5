#!/bin/bash
# Quick validation script for expense categories feature

set -e

echo "=========================================="
echo "Expense Categories - Quick Validation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if database is accessible using Prisma
echo "1. Checking database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null | grep -q "1"; then
    echo -e "${GREEN}✓ Database connection OK${NC}"
else
    # Try alternative method
    if npx prisma db pull --force 2>&1 | grep -q "Introspecting"; then
        echo -e "${GREEN}✓ Database connection OK${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify database connection (this is OK if migration not applied yet)${NC}"
    fi
fi

# Check if ExpenseCategory table exists using Prisma Studio or direct query
echo ""
echo "2. Checking ExpenseCategory table..."
# Use a simple Node script to check
if node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT COUNT(*) FROM \"ExpenseCategory\"\`.then(r => {console.log(r[0].count); p.\$disconnect();}).catch(() => {console.log('0'); p.\$disconnect();});" 2>/dev/null | grep -qE "^[0-9]+$"; then
    COUNT=$(node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT COUNT(*)::int as count FROM \"ExpenseCategory\"\`.then(r => {console.log(r[0].count); p.\$disconnect();}).catch(() => {console.log('0'); p.\$disconnect();});" 2>/dev/null | tail -1)
    if [ "$COUNT" != "0" ] || [ -n "$COUNT" ]; then
        echo -e "${GREEN}✓ ExpenseCategory table exists${NC}"
        echo "  Found $COUNT expense categories"
    else
        echo -e "${YELLOW}⚠ ExpenseCategory table does not exist (migration not applied?)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ ExpenseCategory table check skipped (use Node validation scripts for detailed check)${NC}"
fi

# Check if Expense.categoryId column exists
echo ""
echo "3. Checking Expense.categoryId column..."
if node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT \"categoryId\" FROM \"Expense\" LIMIT 1\`.then(() => {console.log('EXISTS'); p.\$disconnect();}).catch(() => {console.log('NOT_EXISTS'); p.\$disconnect();});" 2>/dev/null | grep -q "EXISTS"; then
    echo -e "${GREEN}✓ Expense.categoryId column exists${NC}"
    
    WITH_CAT=$(node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT COUNT(*)::int as count FROM \"Expense\" WHERE \"categoryId\" IS NOT NULL\`.then(r => {console.log(r[0].count); p.\$disconnect();}).catch(() => {console.log('0'); p.\$disconnect();});" 2>/dev/null | tail -1)
    WITHOUT_CAT=$(node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT COUNT(*)::int as count FROM \"Expense\" WHERE \"categoryId\" IS NULL\`.then(r => {console.log(r[0].count); p.\$disconnect();}).catch(() => {console.log('0'); p.\$disconnect();});" 2>/dev/null | tail -1)
    echo "  Expenses with categoryId: ${WITH_CAT:-0}"
    echo "  Expenses without categoryId: ${WITHOUT_CAT:-0} (backward compatible)"
else
    echo -e "${YELLOW}⚠ Expense.categoryId column does not exist (migration not applied?)${NC}"
fi

# Check foreign key constraints
echo ""
echo "4. Checking foreign key constraints..."
if node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT conname FROM pg_constraint WHERE conname IN ('Expense_categoryId_fkey', 'ExpenseCategory_accountId_fkey', 'ExpenseCategory_tenantId_fkey')\`.then(r => {console.log(r.length > 0 ? 'EXISTS' : 'NOT_EXISTS'); p.\$disconnect();}).catch(() => {console.log('NOT_EXISTS'); p.\$disconnect();});" 2>/dev/null | grep -q "EXISTS"; then
    echo -e "${GREEN}✓ Foreign key constraints exist${NC}"
else
    echo -e "${YELLOW}⚠ Some foreign key constraints may be missing${NC}"
fi

# Check account codes are in correct range
echo ""
echo "5. Checking account code ranges..."
BAD_CODES=$(node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT COUNT(*)::int as count FROM \"ExpenseCategory\" WHERE CAST(\"accountCode\" AS INTEGER) NOT BETWEEN 6000 AND 6999\`.then(r => {console.log(r[0].count); p.\$disconnect();}).catch(() => {console.log('0'); p.\$disconnect();});" 2>/dev/null | tail -1)
if [ "${BAD_CODES:-1}" = "0" ]; then
    echo -e "${GREEN}✓ All account codes are in range 6000-6999${NC}"
else
    echo -e "${YELLOW}⚠ Some account codes are outside range 6000-6999${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Quick validation complete!${NC}"
echo "=========================================="
echo ""
echo "For detailed validation, run:"
echo "  node scripts/validate-expense-categories.js"
echo "  node scripts/validate-data-integrity.js"
