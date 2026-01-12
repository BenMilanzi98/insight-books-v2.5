#!/bin/bash

# Database Backup Script
# Creates a timestamped backup of your database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it with: export DATABASE_URL='postgresql://henmik:Password2030@localhost:5432/insightbooks?schema=public'"
    exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.dump"

echo -e "${YELLOW}Creating database backup...${NC}"
echo "Backup file: ${BACKUP_FILE}"

# Create backup using pg_dump
pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "File: ${BACKUP_FILE}"
    echo ""
    echo "To restore this backup:"
    echo "pg_restore -d \"\$DATABASE_URL\" -c ${BACKUP_FILE}"
else
    echo "❌ Backup failed!"
    exit 1
fi

